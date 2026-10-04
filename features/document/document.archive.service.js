const path = require('path');
const mongoose = require('mongoose');
const { ZipArchive } = require('archiver');
const unzipper = require('unzipper');
const { PassThrough, Transform, pipeline } = require('stream');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { deleteObject, getObjectStream, uploadStream } = require('#core/s3/s3.config');
const { buildS3Key } = require('#core/upload/upload.helper');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const documentModel = require('./document.model');
const documentFolderModel = require('./documentFolder.model');
const {
  DOCUMENT_UPLOAD_FEATURE,
  findSourceEntity,
  buildDocumentKeyPrefix,
  stripFileExtension,
  resolveMimeTypeFromFileName,
  serializeDocument,
  normalizeArea,
  buildAreaFilter,
} = require('./document.helper');

const MAXIMUM_ARCHIVE_ENTRIES = 50000;
const IGNORED_ARCHIVE_PATTERN = /(^|\/)(__MACOSX\/|\.DS_Store$)/;

const refreshDashboard = () => {
  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('documents');
};

const assertValidIds = (ids) => {
  if (!Array.isArray(ids) || !ids.every((id) => mongoose.isValidObjectId(id))) {
    throw new AppError('Invalid ID list', HTTP.BAD_REQUEST);
  }
};

const sanitizePathSegment = (segment) =>
  String(segment).replace(/[\\/:*?"<>|]/g, '_').replace(/\p{C}/gu, '').trim();

const buildDocumentFileName = (documentItem) => {
  const extension = path.extname(documentItem.originalFileName);
  const alreadyHasExtension = extension && documentItem.displayName.toLowerCase().endsWith(extension.toLowerCase());
  return alreadyHasExtension ? documentItem.displayName : `${documentItem.displayName}${extension}`;
};

const buildUniqueArchivePath = (usedPaths, desiredPath) => {
  if (!usedPaths.has(desiredPath.toLowerCase())) {
    usedPaths.add(desiredPath.toLowerCase());
    return desiredPath;
  }
  const extension = path.posix.extname(desiredPath);
  const basePath = desiredPath.slice(0, desiredPath.length - extension.length);
  let counter = 2;
  while (usedPaths.has(`${basePath} (${counter})${extension}`.toLowerCase())) counter += 1;
  const uniquePath = `${basePath} (${counter})${extension}`;
  usedPaths.add(uniquePath.toLowerCase());
  return uniquePath;
};

const normalizeEntryPath = (rawPath) => {
  const normalizedPath = path.posix.normalize(String(rawPath).replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalizedPath || normalizedPath === '.' || normalizedPath.startsWith('..')) return '';
  return normalizedPath.split('/').map(sanitizePathSegment).filter(Boolean).join('/');
};

const collectArchiveEntries = async ({ sourceType, sourceId, documentIds, folderIds }) => {
  const entries = [];
  const usedPaths = new Set();

  const addEntry = (documentItem, parentPath) => {
    entries.push({
      s3Key: documentItem.s3Key,
      fileSize: documentItem.fileSize || 0,
      archivePath: buildUniqueArchivePath(usedPaths, `${parentPath}${sanitizePathSegment(buildDocumentFileName(documentItem))}`),
    });
  };

  const selectedDocuments = await documentModel.find({ _id: { $in: documentIds }, sourceType, sourceId, deletedAt: null });
  selectedDocuments.forEach((documentItem) => addEntry(documentItem, ''));

  const rootFolders = await documentFolderModel.find({ _id: { $in: folderIds }, sourceType, sourceId, deletedAt: null });
  if (rootFolders.length > 0) {
    const [activeFolders, activeDocuments] = await Promise.all([
      documentFolderModel.find({ sourceType, sourceId, deletedAt: null }).lean(),
      documentModel.find({ sourceType, sourceId, deletedAt: null, folderId: { $ne: null } }).lean(),
    ]);
    const childFoldersByParentId = new Map();
    const documentsByFolderId = new Map();
    activeFolders.forEach((folderItem) => {
      if (!folderItem.parentFolderId) return;
      const parentId = folderItem.parentFolderId.toString();
      childFoldersByParentId.set(parentId, [...(childFoldersByParentId.get(parentId) || []), folderItem]);
    });
    activeDocuments.forEach((documentItem) => {
      const folderId = documentItem.folderId.toString();
      documentsByFolderId.set(folderId, [...(documentsByFolderId.get(folderId) || []), documentItem]);
    });

    const walkFolder = (folderItem, parentPath) => {
      const folderPath = `${parentPath}${sanitizePathSegment(folderItem.name)}/`;
      (documentsByFolderId.get(folderItem._id.toString()) || []).forEach((documentItem) => addEntry(documentItem, folderPath));
      (childFoldersByParentId.get(folderItem._id.toString()) || []).forEach((childFolder) => walkFolder(childFolder, folderPath));
    };
    rootFolders.forEach((rootFolder) => walkFolder(rootFolder, ''));
  }

  return entries;
};

const resolveArchiveName = async ({ documentIds, folderIds }) => {
  if (documentIds.length + folderIds.length !== 1) return 'Archive';
  if (documentIds.length === 1) {
    const documentItem = await documentModel.findById(documentIds[0]).select('displayName').lean();
    return documentItem ? stripFileExtension(documentItem.displayName) : 'Archive';
  }
  const folderItem = await documentFolderModel.findById(folderIds[0]).select('name').lean();
  return folderItem ? folderItem.name : 'Archive';
};

const appendEntryAndWait = (archive, entry, bodyStream) =>
  new Promise((resolve, reject) => {
    const handleEntry = (entryData) => {
      if (entryData.name !== entry.archivePath) return;
      archive.off('entry', handleEntry);
      archive.off('error', handleError);
      bodyStream.off('error', handleError);
      resolve();
    };
    const handleError = (error) => {
      archive.off('entry', handleEntry);
      archive.off('error', handleError);
      bodyStream.off('error', handleError);
      reject(error);
    };
    archive.on('entry', handleEntry);
    archive.once('error', handleError);
    bodyStream.once('error', handleError);
    archive.append(bodyStream, { name: entry.archivePath });
  });

const compressItems = async ({ sourceType, sourceId, documentIds, folderIds, targetFolderId, area, uploadedBy }) => {
  assertValidIds(documentIds);
  assertValidIds(folderIds);
  const sourceEntity = await findSourceEntity(sourceType, sourceId);
  if (!sourceEntity) throw new AppError(`${sourceType} not found`, HTTP.NOT_FOUND);

  let targetArea = normalizeArea(area, sourceType);
  if (targetFolderId) {
    const targetFolder =
      mongoose.isValidObjectId(targetFolderId) &&
      (await documentFolderModel.findOne({ _id: targetFolderId, sourceType, sourceId, deletedAt: null }));
    if (!targetFolder) throw new AppError('Folder not found', HTTP.NOT_FOUND);
    targetArea = targetFolder.area || 'all';
  }

  const entries = await collectArchiveEntries({ sourceType, sourceId, documentIds, folderIds });
  if (entries.length === 0) throw new AppError('Nothing to compress', HTTP.BAD_REQUEST);
  if (entries.length > MAXIMUM_ARCHIVE_ENTRIES) {
    throw new AppError(`Too many files. The limit is ${MAXIMUM_ARCHIVE_ENTRIES}`, HTTP.BAD_REQUEST);
  }

  const archiveName = await resolveArchiveName({ documentIds, folderIds });
  const s3Key = buildS3Key(DOCUMENT_UPLOAD_FEATURE, buildDocumentKeyPrefix(sourceType, sourceId), 'archive.zip');

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const outputStream = new PassThrough();
  archive.on('error', (error) => outputStream.destroy(error));
  archive.pipe(outputStream);
  const uploadPromise = uploadStream(s3Key, outputStream, 'application/zip');
  uploadPromise.catch(() => null);

  try {
    for (const entry of entries) {
      await appendEntryAndWait(archive, entry, await getObjectStream(entry.s3Key));
    }
    await archive.finalize();
    await uploadPromise;
  } catch (error) {
    archive.abort();
    outputStream.destroy();
    await uploadPromise.catch(() => null);
    await deleteObject(s3Key).catch(() => null);
    logger.error('[document.archive.service] compressItems', error);
    throw error;
  }

  const createdDocument = await documentModel.create({
    folderId: targetFolderId || null,
    area: targetArea,
    sourceType,
    sourceId,
    displayName: archiveName,
    originalFileName: `${archiveName}.zip`,
    s3Key,
    mimeType: 'application/zip',
    fileSize: archive.pointer(),
    uploadedBy,
  });

  refreshDashboard();
  return { status: HTTP.CREATED, message: 'Archive created', data: await serializeDocument(createdDocument) };
};

class ByteLimitTransform extends Transform {
  constructor(maximumBytes) {
    super();
    this.maximumBytes = maximumBytes;
    this.totalBytes = 0;
  }

  _transform(chunk, encoding, callback) {
    this.totalBytes += chunk.length;
    if (this.totalBytes > this.maximumBytes) {
      callback(new AppError('Archive is too large to extract', HTTP.BAD_REQUEST));
      return;
    }
    callback(null, chunk);
  }
}

const buildAvailableFolderName = async ({ sourceType, sourceId, parentFolderId, area, name }) => {
  let candidate = name;
  let counter = 2;
  while (
    await documentFolderModel
      .exists({ sourceType, sourceId, parentFolderId, area: buildAreaFilter(area), name: candidate, deletedAt: null })
      .collation({ locale: 'en', strength: 2 })
  ) {
    candidate = `${name} (${counter})`;
    counter += 1;
  }
  return candidate;
};

const extractDocument = async ({ documentId, uploadedBy }) => {
  if (!mongoose.isValidObjectId(documentId)) throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  const zipDocument = await documentModel.findOne({ _id: documentId, deletedAt: null });
  if (!zipDocument) throw new AppError('Document not found', HTTP.NOT_FOUND);
  const isZip =
    path.extname(zipDocument.originalFileName).toLowerCase() === '.zip' || zipDocument.mimeType.toLowerCase().includes('zip');
  if (!isZip) throw new AppError('Only zip files can be extracted', HTTP.BAD_REQUEST);

  const { sourceType, sourceId } = zipDocument;
  const zipArea = zipDocument.area || 'all';
  const rootFolder = await documentFolderModel.create({
    sourceType,
    sourceId,
    parentFolderId: zipDocument.folderId,
    area: zipArea,
    name: await buildAvailableFolderName({
      sourceType,
      sourceId,
      parentFolderId: zipDocument.folderId,
      area: zipArea,
      name: sanitizePathSegment(stripFileExtension(zipDocument.displayName)) || 'Extracted',
    }),
  });

  const folderIdByPath = new Map([['', rootFolder._id]]);
  const createdFolderIds = [rootFolder._id];
  const createdDocumentIds = [];
  const createdStorageKeys = [];
  let entryCount = 0;
  let extractedBytes = 0;
  let parser = null;

  const ensureFolder = async (directoryPath) => {
    if (folderIdByPath.has(directoryPath)) return folderIdByPath.get(directoryPath);
    const pathSegments = directoryPath.split('/');
    const folderName = pathSegments.pop();
    const parentFolderId = await ensureFolder(pathSegments.join('/'));
    const createdFolder = await documentFolderModel.create({ sourceType, sourceId, parentFolderId, area: zipArea, name: folderName });
    folderIdByPath.set(directoryPath, createdFolder._id);
    createdFolderIds.push(createdFolder._id);
    return createdFolder._id;
  };

  try {
    const zipStream = await getObjectStream(zipDocument.s3Key);
    parser = unzipper.Parse({ forceStream: true });
    zipStream.on('error', (error) => parser.destroy(error));
    zipStream.pipe(parser);

    for await (const entry of parser) {
      entryCount += 1;
      if (entryCount > MAXIMUM_ARCHIVE_ENTRIES) {
        throw new AppError(`Archive has too many files. The limit is ${MAXIMUM_ARCHIVE_ENTRIES}`, HTTP.BAD_REQUEST);
      }

      const safePath = normalizeEntryPath(entry.path);
      if (!safePath || IGNORED_ARCHIVE_PATTERN.test(safePath)) {
        entry.autodrain();
        continue;
      }
      if (entry.type === 'Directory') {
        await ensureFolder(safePath);
        entry.autodrain();
        continue;
      }

      const pathSegments = safePath.split('/');
      const fileName = pathSegments.pop();
      const folderId = await ensureFolder(pathSegments.join('/'));

      const limitedStream = new ByteLimitTransform(Number.POSITIVE_INFINITY);
      pipeline(entry, limitedStream, () => null);

      const s3Key = buildS3Key(DOCUMENT_UPLOAD_FEATURE, buildDocumentKeyPrefix(sourceType, sourceId), fileName);
      createdStorageKeys.push(s3Key);
      await uploadStream(s3Key, limitedStream, resolveMimeTypeFromFileName(fileName));
      extractedBytes += limitedStream.totalBytes;

      const createdDocument = await documentModel.create({
        folderId,
        area: zipArea,
        sourceType,
        sourceId,
        displayName: stripFileExtension(fileName) || fileName,
        originalFileName: fileName,
        s3Key,
        mimeType: resolveMimeTypeFromFileName(fileName),
        fileSize: limitedStream.totalBytes,
        uploadedBy,
      });
      createdDocumentIds.push(createdDocument._id);
    }
  } catch (error) {
    if (parser) parser.destroy();
    await Promise.allSettled(createdStorageKeys.map((storageKey) => deleteObject(storageKey)));
    await documentModel.deleteMany({ _id: { $in: createdDocumentIds } });
    await documentFolderModel.deleteMany({ _id: { $in: createdFolderIds } });
    logger.error('[document.archive.service] extractDocument', error);
    throw error instanceof AppError ? error : new AppError('Failed to extract archive', HTTP.INTERNAL_SERVER_ERROR);
  }

  refreshDashboard();
  return {
    status: HTTP.CREATED,
    message: 'Archive extracted',
    data: { folderId: rootFolder._id.toString(), documentCount: createdDocumentIds.length },
  };
};

module.exports = { compressItems, extractDocument };