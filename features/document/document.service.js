const mongoose = require('mongoose');
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { copyObject } = require('#core/s3/s3.config');
const { getCompletedSessions } = require('#core/upload/upload.service');
const { buildS3Key } = require('#core/upload/upload.helper');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const documentModel = require('./document.model');
const documentFolderModel = require('./documentFolder.model');
const {
  DOCUMENT_UPLOAD_FEATURE,
  RENEWAL_STATUS,
  findSourceEntity,
  buildDocumentKeyPrefix,
  stripFileExtension,
  isPdfMimeType,
  toDateOrNull,
  downloadPdfBufferFromS3,
  uploadPdfBytesToS3,
  serializeDocument,
  normalizeArea,
  buildAreaFilter,
  SOURCE_TYPE_LABELS,
  resolveSourceLabel,
} = require('./document.helper');

const refreshDashboard = () => {
  dashboardServices.clearDashboardCache();
  wsUtils.dispatchDashboardUpdate('documents');
};

const requireSource = async (sourceType, sourceId) => {
  const sourceEntity = await findSourceEntity(sourceType, sourceId);
  if (!sourceEntity) throw new AppError(`${sourceType} not found`, HTTP.NOT_FOUND);
  return sourceEntity;
};

const requireDocument = async (documentId) => {
  if (!mongoose.isValidObjectId(documentId)) throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  const documentItem = await documentModel.findOne({ _id: documentId, deletedAt: null });
  if (!documentItem) throw new AppError('Document not found', HTTP.NOT_FOUND);
  return documentItem;
};

const serializeFolder = (folderItem) => ({
  _id: folderItem._id.toString(),
  sourceType: folderItem.sourceType,
  sourceId: folderItem.sourceId,
  parentFolderId: folderItem.parentFolderId ? folderItem.parentFolderId.toString() : null,
  name: folderItem.name,
  area: folderItem.area || 'all',
});

const requireFolder = async (folderId, sourceType, sourceId) => {
  if (!mongoose.isValidObjectId(folderId)) throw new AppError('Invalid folder ID', HTTP.BAD_REQUEST);
  const folderItem = await documentFolderModel.findOne({ _id: folderId, sourceType, sourceId, deletedAt: null });
  if (!folderItem) throw new AppError('Folder not found', HTTP.NOT_FOUND);
  return folderItem;
};

const resolvePlacement = async ({ sourceType, sourceId, folderId, area }) => {
  if (folderId) {
    const folderItem = await requireFolder(folderId, sourceType, sourceId);
    return { folderId: folderItem._id, area: folderItem.area || 'all' };
  }
  return { folderId: null, area: normalizeArea(area, sourceType) };
};

const resolveDestination = async ({
  targetSourceType,
  targetSourceId,
  currentSourceType,
  currentSourceId,
  folderId,
  area,
}) => {
  const sourceType = targetSourceType || currentSourceType;
  const sourceId = targetSourceId || currentSourceId;
  await requireSource(sourceType, sourceId);
  const placement = await resolvePlacement({ sourceType, sourceId, folderId, area });
  return { sourceType, sourceId, folderId: placement.folderId, area: placement.area };
};

const assertFolderNameAvailable = async ({ sourceType, sourceId, parentFolderId, name, area, excludeFolderId }) => {
  const filter = { sourceType, sourceId, parentFolderId, name, area: buildAreaFilter(area || 'all'), deletedAt: null };
  if (excludeFolderId) filter._id = { $ne: excludeFolderId };
  const existingFolder = await documentFolderModel.exists(filter).collation({ locale: 'en', strength: 2 });
  if (existingFolder) throw new AppError('A folder with this name already exists here', HTTP.CONFLICT);
};

const assertSessionBelongsToSource = (session, sourceType, sourceId) => {
  if (session.context !== sourceType || session.entityId !== sourceId) {
    throw new AppError('Upload session does not belong to this source', HTTP.BAD_REQUEST);
  }
};

const buildDocumentFromSession = (
  session,
  uploadedBy,
  folderId = null,
  area = 'all'
) => {
  const displayName =
    stripFileExtension(session.originalName || '').trim() ||
    stripFileExtension(session.fileName || '').trim() ||
    'Untitled document';

  return {
    folderId,
    area,
    sourceType: session.context,
    sourceId: session.entityId,
    displayName,
    originalFileName: session.originalName,
    s3Key: session.s3Key,
    mimeType: session.mimeType,
    fileSize: session.fileSize,
    uploadSessionId: session._id.toString(),
    uploadedBy,
  };
};

const saveGeneratedPdf = async ({ pdfBytes, sourceType, sourceId, displayName, issueDate, expiryDate, uploadedBy, folderId = null, area = 'all' }) => {
  const s3Key = buildS3Key(DOCUMENT_UPLOAD_FEATURE, buildDocumentKeyPrefix(sourceType, sourceId), 'document.pdf');
  await uploadPdfBytesToS3(pdfBytes, s3Key);
  return documentModel.create({
    folderId,
    area,
    sourceType,
    sourceId,
    displayName,
    originalFileName: `${displayName}.pdf`,
    s3Key,
    mimeType: 'application/pdf',
    fileSize: pdfBytes.length,
    issueDate,
    expiryDate,
    uploadedBy,
  });
};

const getDocumentsBySource = async ({ sourceType, sourceId }) => {
  await requireSource(sourceType, sourceId);
  const documents = await documentModel.find({ sourceType, sourceId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  const data = await Promise.all(documents.map(serializeDocument));
  return { status: HTTP.OK, message: 'Documents retrieved', data };
};

const ensureFolderPath = async ({ sourceType, sourceId, area, parentFolderId, directoryPath, cache }) => {
  let currentParentId = parentFolderId;
  let currentKey = '';
  const segments = String(directoryPath)
    .split('/')
    .map((segment) => segment.trim().slice(0, 100))
    .filter((segment) => segment && segment !== '.' && segment !== '..');
  for (const segment of segments) {
    currentKey = `${currentKey}/${segment}`;
    if (!cache.has(currentKey)) {
      const existingFolder = await documentFolderModel
        .findOne({ sourceType, sourceId, parentFolderId: currentParentId, area: buildAreaFilter(area), deletedAt: null, name: segment })
        .collation({ locale: 'en', strength: 2 });
      const folderItem =
        existingFolder ||
        (await documentFolderModel.create({ sourceType, sourceId, parentFolderId: currentParentId, area, name: segment }));
      cache.set(currentKey, folderItem._id);
    }
    currentParentId = cache.get(currentKey);
  }
  return currentParentId;
};

const registerUploadedDocuments = async ({
  sourceType,
  sourceId,
  sessionIds,
  uploadedBy,
  folderId,
  area,
  directoryBySessionId = {},
  emptyDirectories = [],
}) => {
  await requireSource(sourceType, sourceId);
  const placement = await resolvePlacement({ sourceType, sourceId, folderId, area });
  const folderCache = new Map();
  const resolveDirectory = (directoryPath) =>
    ensureFolderPath({
      sourceType,
      sourceId,
      area: placement.area,
      parentFolderId: placement.folderId,
      directoryPath,
      cache: folderCache,
    });

  for (const directoryPath of emptyDirectories) await resolveDirectory(directoryPath);

  const sessions =
    sessionIds.length > 0 ? await getCompletedSessions({ sessionIds, uploadedBy, feature: DOCUMENT_UPLOAD_FEATURE }) : [];
  sessions.forEach((session) => assertSessionBelongsToSource(session, sourceType, sourceId));

  const alreadyRegisteredSessionIds = await documentModel.distinct('uploadSessionId', {
    uploadSessionId: { $in: sessionIds },
  });
  const pendingSessions = sessions.filter((session) => !alreadyRegisteredSessionIds.includes(session._id.toString()));

  const documentsToCreate = [];
  for (const session of pendingSessions) {
    const directoryPath = directoryBySessionId[session._id.toString()];
    const targetFolderId = directoryPath ? await resolveDirectory(directoryPath) : placement.folderId;
    documentsToCreate.push(buildDocumentFromSession(session, uploadedBy, targetFolderId, placement.area));
  }
  const createdDocuments = await documentModel.insertMany(documentsToCreate);

  refreshDashboard();
  const data = await Promise.all(createdDocuments.map(serializeDocument));
  return { status: HTTP.CREATED, message: 'Documents added', data };
};

const renewDocument = async ({ documentId, uploadSessionId, issueDate, expiryDate, uploadedBy }) => {
  const previousDocument = await requireDocument(documentId);
  if (previousDocument.renewalStatus === RENEWAL_STATUS.EXPIRED) {
    throw new AppError('Expired documents cannot be renewed', HTTP.CONFLICT);
  }

  const [session] = await getCompletedSessions({
    sessionIds: [uploadSessionId],
    uploadedBy,
    feature: DOCUMENT_UPLOAD_FEATURE,
  });
  assertSessionBelongsToSource(session, previousDocument.sourceType, previousDocument.sourceId);

  const renewedDocument = await documentModel.create({
    ...buildDocumentFromSession(session, uploadedBy, previousDocument.folderId, previousDocument.area || 'all'),
    displayName: previousDocument.displayName,
    issueDate: toDateOrNull(issueDate),
    expiryDate: toDateOrNull(expiryDate),
    renewalStatus: RENEWAL_STATUS.RENEWED,
    renewedFromDocumentId: previousDocument._id,
  });

  previousDocument.renewalStatus = RENEWAL_STATUS.EXPIRED;
  await previousDocument.save();

  refreshDashboard();
  return { status: HTTP.OK, message: 'Document renewed', data: await serializeDocument(renewedDocument) };
};

const updateDocumentDates = async ({ documentId, issueDate, expiryDate }) => {
  const documentItem = await requireDocument(documentId);
  documentItem.issueDate = toDateOrNull(issueDate);
  documentItem.expiryDate = toDateOrNull(expiryDate);
  await documentItem.save();
  refreshDashboard();
  return { status: HTTP.OK, message: 'Dates updated', data: await serializeDocument(documentItem) };
};

const renameDocument = async ({ documentId, newFileName }) => {
  const documentItem = await requireDocument(documentId);
  documentItem.displayName = newFileName;
  await documentItem.save();
  return { status: HTTP.OK, message: 'Document renamed', data: await serializeDocument(documentItem) };
};

const mergeDocuments = async ({ sourceType, sourceId, documentIds, uploadedBy }) => {
  await requireSource(sourceType, sourceId);

  const uniqueDocumentIds = [...new Set(documentIds)];
  if (!uniqueDocumentIds.every((documentId) => mongoose.isValidObjectId(documentId))) {
    throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  }

  const documents = await documentModel.find({ _id: { $in: uniqueDocumentIds }, sourceType, sourceId, deletedAt: null });
  if (documents.length !== uniqueDocumentIds.length) throw new AppError('One or more documents not found', HTTP.NOT_FOUND);

  const documentById = new Map(documents.map((documentItem) => [documentItem._id.toString(), documentItem]));
  const orderedDocuments = uniqueDocumentIds.map((documentId) => documentById.get(documentId));

  const nonPdfDocument = orderedDocuments.find((documentItem) => !isPdfMimeType(documentItem.mimeType));
  if (nonPdfDocument) throw new AppError(`${nonPdfDocument.displayName} is not a PDF`, HTTP.BAD_REQUEST);

  const mergedPdf = await PDFDocument.create();
  for (const documentItem of orderedDocuments) {
    const sourcePdf = await PDFDocument.load(await downloadPdfBufferFromS3(documentItem.s3Key));
    const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedDocument = await saveGeneratedPdf({
    pdfBytes: await mergedPdf.save(),
    sourceType,
    sourceId,
    displayName: 'Merged Document',
    folderId: orderedDocuments[0].folderId,
    area: orderedDocuments[0].area || 'all',
    issueDate: null,
    expiryDate: null,
    uploadedBy,
  });

  refreshDashboard();
  return { status: HTTP.CREATED, message: 'Documents merged', data: await serializeDocument(mergedDocument) };
};

const splitDocument = async ({ documentId, splitType, pages, uploadedBy }) => {
  const sourceDocument = await requireDocument(documentId);
  if (!isPdfMimeType(sourceDocument.mimeType)) throw new AppError('Only PDF files can be split', HTTP.BAD_REQUEST);

  const sourcePdf = await PDFDocument.load(await downloadPdfBufferFromS3(sourceDocument.s3Key));
  const totalPages = sourcePdf.getPageCount();

  const pageGroups =
    splitType === 'every'
      ? Array.from({ length: totalPages }, (_, index) => [index + 1])
      : [
          [...new Set(pages)]
            .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages)
            .sort((firstPage, secondPage) => firstPage - secondPage),
        ];

  const validPageGroups = pageGroups.filter((pageGroup) => pageGroup.length > 0);
  if (validPageGroups.length === 0) throw new AppError('No valid pages to extract', HTTP.BAD_REQUEST);

  const createdDocuments = [];
  for (const pageGroup of validPageGroups) {
    const splitPdf = await PDFDocument.create();
    const copiedPages = await splitPdf.copyPages(sourcePdf, pageGroup.map((pageNumber) => pageNumber - 1));
    copiedPages.forEach((page) => splitPdf.addPage(page));

    const pageLabel = pageGroup.length === 1 ? `Page ${pageGroup[0]}` : `Pages ${pageGroup.join(', ')}`;
    const createdDocument = await saveGeneratedPdf({
      pdfBytes: await splitPdf.save(),
      sourceType: sourceDocument.sourceType,
      sourceId: sourceDocument.sourceId,
      displayName: `${sourceDocument.displayName} (${pageLabel})`,
      folderId: sourceDocument.folderId,
      area: sourceDocument.area || 'all',
      issueDate: sourceDocument.issueDate,
      expiryDate: sourceDocument.expiryDate,
      uploadedBy,
    });
    createdDocuments.push(createdDocument);
  }

  refreshDashboard();
  const data = await Promise.all(createdDocuments.map(serializeDocument));
  return { status: HTTP.CREATED, message: 'PDF split', data };
};

const getFoldersBySource = async ({ sourceType, sourceId }) => {
  await requireSource(sourceType, sourceId);
  const folders = await documentFolderModel.find({ sourceType, sourceId, deletedAt: null }).sort({ name: 1 }).lean();
  return { status: HTTP.OK, message: 'Folders retrieved', data: folders.map(serializeFolder) };
};

const createFolder = async ({ sourceType, sourceId, parentFolderId, area, name }) => {
  await requireSource(sourceType, sourceId);
  const placement = await resolvePlacement({ sourceType, sourceId, folderId: parentFolderId, area });
  await assertFolderNameAvailable({
    sourceType,
    sourceId,
    parentFolderId: placement.folderId,
    area: placement.area,
    name,
  });
  const createdFolder = await documentFolderModel.create({
    sourceType,
    sourceId,
    parentFolderId: placement.folderId,
    area: placement.area,
    name,
  });
  return { status: HTTP.CREATED, message: 'Folder created', data: serializeFolder(createdFolder) };
};

const renameFolder = async ({ folderId, name }) => {
  if (!mongoose.isValidObjectId(folderId)) throw new AppError('Invalid folder ID', HTTP.BAD_REQUEST);
  const folderItem = await documentFolderModel.findOne({ _id: folderId, deletedAt: null });
  if (!folderItem) throw new AppError('Folder not found', HTTP.NOT_FOUND);
  await assertFolderNameAvailable({
    sourceType: folderItem.sourceType,
    sourceId: folderItem.sourceId,
    parentFolderId: folderItem.parentFolderId,
    name,
    area: folderItem.area || 'all',
    excludeFolderId: folderItem._id,
  });
  folderItem.name = name;
  await folderItem.save();
  return { status: HTTP.OK, message: 'Folder renamed', data: serializeFolder(folderItem) };
};

const normalizeRotation = (value) => {
  const rotation = Number(value || 0);
  if (!Number.isInteger(rotation) || rotation % 90 !== 0) throw new AppError('Invalid rotation', HTTP.BAD_REQUEST);
  return ((rotation % 360) + 360) % 360;
};

const applyPageRotation = (page, rotation) => {
  if (rotation === 0) return;
  page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
};

const collectFolderTreeIds = async (rootFolder) => {
  const allFolders = await documentFolderModel
    .find({ sourceType: rootFolder.sourceType, sourceId: rootFolder.sourceId, deletedAt: null })
    .select('_id parentFolderId');
  const childIdsByParentId = new Map();
  allFolders.forEach((folderItem) => {
    if (!folderItem.parentFolderId) return;
    const parentId = folderItem.parentFolderId.toString();
    childIdsByParentId.set(parentId, [...(childIdsByParentId.get(parentId) || []), folderItem._id.toString()]);
  });
  const treeIds = [];
  const pendingIds = [rootFolder._id.toString()];
  while (pendingIds.length > 0) {
    const currentId = pendingIds.pop();
    treeIds.push(currentId);
    pendingIds.push(...(childIdsByParentId.get(currentId) || []));
  }
  return treeIds;
};

const requireFolderById = async (folderId) => {
  if (!mongoose.isValidObjectId(folderId)) throw new AppError('Invalid folder ID', HTTP.BAD_REQUEST);
  const folderItem = await documentFolderModel.findOne({ _id: folderId, deletedAt: null });
  if (!folderItem) throw new AppError('Folder not found', HTTP.NOT_FOUND);
  return folderItem;
};

const buildAvailableFolderName = async ({ sourceType, sourceId, parentFolderId, area, name }) => {
  let candidate = name;
  let counter = 1;
  while (
    await documentFolderModel
      .exists({ sourceType, sourceId, parentFolderId, area: buildAreaFilter(area), name: candidate, deletedAt: null })
      .collation({ locale: 'en', strength: 2 })
  ) {
    candidate = counter === 1 ? `${name} (Copy)` : `${name} (Copy ${counter})`;
    counter += 1;
  }
  return candidate;
};

const copyDocument = async ({ documentId, folderId, area, targetSourceType, targetSourceId, uploadedBy }) => {
  const sourceDocument = await requireDocument(documentId);
  const destination = await resolveDestination({
    targetSourceType,
    targetSourceId,
    currentSourceType: sourceDocument.sourceType,
    currentSourceId: sourceDocument.sourceId,
    folderId,
    area,
  });

  const copiedS3Key = buildS3Key(
    DOCUMENT_UPLOAD_FEATURE,
    buildDocumentKeyPrefix(destination.sourceType, destination.sourceId),
    sourceDocument.originalFileName
  );
  await copyObject(sourceDocument.s3Key, copiedS3Key);

  const copiedDocument = await documentModel.create({
    folderId: destination.folderId,
    area: destination.area,
    sourceType: destination.sourceType,
    sourceId: destination.sourceId,
    displayName: `${sourceDocument.displayName} (Copy)`,
    originalFileName: sourceDocument.originalFileName,
    s3Key: copiedS3Key,
    mimeType: sourceDocument.mimeType,
    fileSize: sourceDocument.fileSize,
    issueDate: sourceDocument.issueDate,
    expiryDate: sourceDocument.expiryDate,
    uploadedBy,
  });

  refreshDashboard();
  return { status: HTTP.CREATED, message: 'Document copied', data: await serializeDocument(copiedDocument) };
};

const moveDocument = async ({ documentId, folderId, area, targetSourceType, targetSourceId }) => {
  const documentItem = await requireDocument(documentId);
  const destination = await resolveDestination({
    targetSourceType,
    targetSourceId,
    currentSourceType: documentItem.sourceType,
    currentSourceId: documentItem.sourceId,
    folderId,
    area,
  });
  documentItem.sourceType = destination.sourceType;
  documentItem.sourceId = destination.sourceId;
  documentItem.folderId = destination.folderId;
  documentItem.area = destination.area;
  await documentItem.save();
  refreshDashboard();
  return { status: HTTP.OK, message: 'Document moved', data: await serializeDocument(documentItem) };
};

const copyFolderTree = async ({ sourceFolder, targetParentId, destination, name, uploadedBy }) => {
  const createdFolder = await documentFolderModel.create({
    sourceType: destination.sourceType,
    sourceId: destination.sourceId,
    parentFolderId: targetParentId,
    area: destination.area,
    name,
  });

  const folderDocuments = await documentModel.find({ folderId: sourceFolder._id, deletedAt: null });
  for (const sourceDocument of folderDocuments) {
    const copiedS3Key = buildS3Key(
      DOCUMENT_UPLOAD_FEATURE,
      buildDocumentKeyPrefix(destination.sourceType, destination.sourceId),
      sourceDocument.originalFileName
    );
    await copyObject(sourceDocument.s3Key, copiedS3Key);
    await documentModel.create({
      folderId: createdFolder._id,
      area: destination.area,
      sourceType: destination.sourceType,
      sourceId: destination.sourceId,
      displayName: sourceDocument.displayName,
      originalFileName: sourceDocument.originalFileName,
      s3Key: copiedS3Key,
      mimeType: sourceDocument.mimeType,
      fileSize: sourceDocument.fileSize,
      issueDate: sourceDocument.issueDate,
      expiryDate: sourceDocument.expiryDate,
      uploadedBy,
    });
  }

  const childFolders = await documentFolderModel.find({ parentFolderId: sourceFolder._id, deletedAt: null });
  for (const childFolder of childFolders) {
    await copyFolderTree({
      sourceFolder: childFolder,
      targetParentId: createdFolder._id,
      destination,
      name: childFolder.name,
      uploadedBy,
    });
  }

  return createdFolder;
};

const moveFolder = async ({ folderId, parentFolderId, area, targetSourceType, targetSourceId }) => {
  const folderItem = await requireFolderById(folderId);
  const treeIds = await collectFolderTreeIds(folderItem);
  const destination = await resolveDestination({
    targetSourceType,
    targetSourceId,
    currentSourceType: folderItem.sourceType,
    currentSourceId: folderItem.sourceId,
    folderId: parentFolderId,
    area,
  });

  if (destination.folderId && treeIds.includes(String(destination.folderId))) {
    throw new AppError('A folder cannot be moved into itself', HTTP.BAD_REQUEST);
  }

  await assertFolderNameAvailable({
    sourceType: destination.sourceType,
    sourceId: destination.sourceId,
    parentFolderId: destination.folderId,
    area: destination.area,
    name: folderItem.name,
    excludeFolderId: folderItem._id,
  });

  const hasPlacementChanged =
    (folderItem.area || 'all') !== destination.area ||
    folderItem.sourceType !== destination.sourceType ||
    folderItem.sourceId !== destination.sourceId;

  folderItem.parentFolderId = destination.folderId;
  folderItem.sourceType = destination.sourceType;
  folderItem.sourceId = destination.sourceId;
  folderItem.area = destination.area;
  await folderItem.save();

  if (hasPlacementChanged) {
    const placementFields = { sourceType: destination.sourceType, sourceId: destination.sourceId, area: destination.area };
    await documentFolderModel.updateMany({ _id: { $in: treeIds } }, { $set: placementFields });
    await documentModel.updateMany({ folderId: { $in: treeIds } }, { $set: placementFields });
  }
  refreshDashboard();
  return { status: HTTP.OK, message: 'Folder moved', data: serializeFolder(folderItem) };
};

const copyFolder = async ({ folderId, parentFolderId, area, targetSourceType, targetSourceId, uploadedBy }) => {
  const sourceFolder = await requireFolderById(folderId);
  const treeIds = await collectFolderTreeIds(sourceFolder);
  const destination = await resolveDestination({
    targetSourceType,
    targetSourceId,
    currentSourceType: sourceFolder.sourceType,
    currentSourceId: sourceFolder.sourceId,
    folderId: parentFolderId,
    area,
  });

  if (destination.folderId && treeIds.includes(String(destination.folderId))) {
    throw new AppError('A folder cannot be copied into itself', HTTP.BAD_REQUEST);
  }

  const name = await buildAvailableFolderName({
    sourceType: destination.sourceType,
    sourceId: destination.sourceId,
    parentFolderId: destination.folderId,
    area: destination.area,
    name: sourceFolder.name,
  });

  const createdFolder = await copyFolderTree({
    sourceFolder,
    targetParentId: destination.folderId,
    destination,
    name,
    uploadedBy,
  });
  refreshDashboard();
  return { status: HTTP.CREATED, message: 'Folder copied', data: serializeFolder(createdFolder) };
};

const editDocumentPages = async ({ documentId, pages }) => {
  const documentItem = await requireDocument(documentId);
  if (!isPdfMimeType(documentItem.mimeType)) throw new AppError('Only PDF files can be edited', HTTP.BAD_REQUEST);

  const sourcePdf = await PDFDocument.load(await downloadPdfBufferFromS3(documentItem.s3Key));
  const totalPages = sourcePdf.getPageCount();

  const pageEdits = pages.map((entry) => {
    const pageNumber = Number(entry?.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
      throw new AppError('Invalid page number', HTTP.BAD_REQUEST);
    }
    return { pageNumber, rotation: normalizeRotation(entry?.rotation) };
  });

  const editedPdf = await PDFDocument.create();
  const copiedPages = await editedPdf.copyPages(
    sourcePdf,
    pageEdits.map((pageEdit) => pageEdit.pageNumber - 1)
  );
  copiedPages.forEach((page, index) => {
    applyPageRotation(page, pageEdits[index].rotation);
    editedPdf.addPage(page);
  });

  const pdfBytes = await editedPdf.save();
  await uploadPdfBytesToS3(pdfBytes, documentItem.s3Key);

  documentItem.fileSize = pdfBytes.length;
  await documentItem.save();

  refreshDashboard();
  return { status: HTTP.OK, message: 'Document updated', data: await serializeDocument(documentItem) };
};

const mergeDocumentPages = async ({ sourceType, sourceId, pages, uploadedBy }) => {
  await requireSource(sourceType, sourceId);

  const documentIds = [...new Set(pages.map((entry) => String(entry?.documentId)))];
  if (!documentIds.every((documentId) => mongoose.isValidObjectId(documentId))) {
    throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  }

  const documents = await documentModel.find({ _id: { $in: documentIds }, sourceType, sourceId, deletedAt: null });
  if (documents.length !== documentIds.length) throw new AppError('One or more documents not found', HTTP.NOT_FOUND);

  const nonPdfDocument = documents.find((documentItem) => !isPdfMimeType(documentItem.mimeType));
  if (nonPdfDocument) throw new AppError(`${nonPdfDocument.displayName} is not a PDF`, HTTP.BAD_REQUEST);

  const sourcePdfById = new Map();
  for (const documentItem of documents) {
    sourcePdfById.set(
      documentItem._id.toString(),
      await PDFDocument.load(await downloadPdfBufferFromS3(documentItem.s3Key))
    );
  }

  const mergedPdf = await PDFDocument.create();
  for (const entry of pages) {
    const sourcePdf = sourcePdfById.get(String(entry.documentId));
    const pageNumber = Number(entry.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > sourcePdf.getPageCount()) {
      throw new AppError('Invalid page number', HTTP.BAD_REQUEST);
    }
    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageNumber - 1]);
    applyPageRotation(copiedPage, normalizeRotation(entry.rotation));
    mergedPdf.addPage(copiedPage);
  }

  const firstDocument = documents.find((documentItem) => documentItem._id.toString() === String(pages[0].documentId));

  const mergedDocument = await saveGeneratedPdf({
    pdfBytes: await mergedPdf.save(),
    sourceType,
    sourceId,
    displayName: 'Merged Document',
    folderId: firstDocument.folderId,
    area: firstDocument.area || 'all',
    issueDate: null,
    expiryDate: null,
    uploadedBy,
  });

  refreshDashboard();
  return { status: HTTP.CREATED, message: 'Documents merged', data: await serializeDocument(mergedDocument) };
};

const setRenewalStatus = async ({ documentId, renewalStatus }) => {
  const documentItem = await requireDocument(documentId);
  documentItem.renewalStatus = renewalStatus;
  await documentItem.save();
  refreshDashboard();
  return { status: HTTP.OK, message: 'Renewal status updated', data: await serializeDocument(documentItem) };
};

const getStorageSummary = async () => {
  const rows = await documentModel.aggregate([
    {
      $group: {
        _id: {
          sourceType: '$sourceType',
          sourceId: '$sourceId',
          isTrashed: { $eq: [{ $type: '$deletedAt' }, 'date'] },
        },
        bytes: { $sum: '$fileSize' },
      },
    },
  ]);

  const sourceByKey = new Map();
  let totalBytes = 0;
  let trashBytes = 0;
  rows.forEach((row) => {
    totalBytes += row.bytes;
    if (row._id.isTrashed) {
      trashBytes += row.bytes;
      return;
    }
    const sourceKey = `${row._id.sourceType}:${row._id.sourceId}`;
    const existing = sourceByKey.get(sourceKey);
    sourceByKey.set(sourceKey, {
      sourceType: row._id.sourceType,
      sourceId: row._id.sourceId,
      bytes: (existing?.bytes || 0) + row.bytes,
    });
  });

  return {
    status: HTTP.OK,
    message: 'Storage retrieved',
    data: { totalBytes, trashBytes, sources: [...sourceByKey.values()] },
  };
};

const SEARCH_RESULT_LIMIT = 100;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchDocuments = async ({ query }) => {
  const term = String(query || '').trim().slice(0, 100);
  if (!term) return { status: HTTP.OK, message: 'Search finished', data: { documents: [], folders: [] } };
  const pattern = new RegExp(escapeRegex(term), 'i');

  const [documents, folders] = await Promise.all([
    documentModel
      .find({ deletedAt: null, $or: [{ displayName: pattern }, { originalFileName: pattern }] })
      .sort({ createdAt: -1 })
      .limit(SEARCH_RESULT_LIMIT)
      .lean(),
    documentFolderModel.find({ deletedAt: null, name: pattern }).sort({ name: 1 }).limit(SEARCH_RESULT_LIMIT).lean(),
  ]);

  const locationLabelByKey = new Map();
  const resolveLocationLabel = async (sourceType, sourceId) => {
    const key = `${sourceType}:${sourceId}`;
    if (!locationLabelByKey.has(key)) {
      const entity = await findSourceEntity(sourceType, sourceId).catch(() => null);
      locationLabelByKey.set(
        key,
        `${SOURCE_TYPE_LABELS[sourceType]} · ${entity ? resolveSourceLabel(sourceType, entity) : 'Deleted source'}`
      );
    }
    return locationLabelByKey.get(key);
  };

  const serializedDocuments = await Promise.all(
    documents.map(async (documentItem) => ({
      ...(await serializeDocument(documentItem)),
      locationLabel: await resolveLocationLabel(documentItem.sourceType, documentItem.sourceId),
    }))
  );
  const serializedFolders = await Promise.all(
    folders.map(async (folderItem) => ({
      ...serializeFolder(folderItem),
      locationLabel: await resolveLocationLabel(folderItem.sourceType, folderItem.sourceId),
    }))
  );

  return {
    status: HTTP.OK,
    message: 'Search finished',
    data: { documents: serializedDocuments, folders: serializedFolders },
  };
};

const PDF_FONT_FAMILIES = {
  Helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
  Times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
  },
  Courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
  },
};

const MAXIMUM_ANNOTATIONS = 2000;
const TEXT_BASELINE_RATIO = 0.93;
const TEXT_LINE_HEIGHT_RATIO = 1.2;
const IMAGE_DATA_URL_PREFIX = /^data:image\/(png|jpeg);base64,/;

const toBoundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const parseHexColor = (value, fallback = '#000000') => {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || '')) || /^#([0-9a-f]{6})$/i.exec(fallback);
  const packed = parseInt(match[1], 16);
  return rgb(((packed >> 16) & 255) / 255, ((packed >> 8) & 255) / 255, (packed & 255) / 255);
};

const buildPageMapper = (page) => {
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getMediaBox();
  const pageWidth = box.width;
  const pageHeight = box.height;
  const isSideways = rotation % 180 !== 0;
  const displayWidth = isSideways ? pageHeight : pageWidth;
  const displayHeight = isSideways ? pageWidth : pageHeight;

  const toPagePoint = (fractionX, fractionY) => {
    const u = fractionX * displayWidth;
    const v = fractionY * displayHeight;
    let point;
    if (rotation === 90) point = { x: v, y: u };
    else if (rotation === 180) point = { x: pageWidth - u, y: v };
    else if (rotation === 270) point = { x: pageWidth - v, y: pageHeight - u };
    else point = { x: u, y: pageHeight - v };
    return { x: point.x + box.x, y: point.y + box.y };
  };

  return { rotation, displayWidth, displayHeight, toPagePoint };
};

const drawAnnotation = async ({ page, mapper, element, getFont, getImage }) => {
  const x = toBoundedNumber(element.x, 0, -1, 2);
  const y = toBoundedNumber(element.y, 0, -1, 2);
  const w = toBoundedNumber(element.w, 0, 0, 3);
  const h = toBoundedNumber(element.h, 0, 0, 3);
  const opacity = toBoundedNumber(element.opacity, 1, 0, 1);
  const rotate = degrees(mapper.rotation);
  const width = w * mapper.displayWidth;
  const height = h * mapper.displayHeight;
  const origin = mapper.toPagePoint(x, y + h);
  const strokeWidth = toBoundedNumber(element.strokeWidth, 2, 0, 50);
  const strokeColor = parseHexColor(element.strokeColor, '#d32f2f');
  const fillColor = element.fillColor ? parseHexColor(element.fillColor) : undefined;

  if (element.type === 'text') {
    const text = String(element.text || '').slice(0, 20000);
    if (!text.trim()) return;
    const size = toBoundedNumber(element.size, 14, 1, 500);
    const font = await getFont(element.fontFamily, element.bold === true, element.italic === true);
    const start = mapper.toPagePoint(x, y + (size * TEXT_BASELINE_RATIO) / mapper.displayHeight);
    try {
      page.drawText(text, {
        x: start.x,
        y: start.y,
        size,
        font,
        color: parseHexColor(element.color),
        rotate,
        lineHeight: size * TEXT_LINE_HEIGHT_RATIO,
        maxWidth: width > 0 ? width : undefined,
        opacity,
      });
    } catch {
      throw new AppError('The text has characters the PDF font cannot show. Use Latin characters.', HTTP.BAD_REQUEST);
    }
    return;
  }

  if (element.type === 'rect') {
    page.drawRectangle({
      x: origin.x,
      y: origin.y,
      width,
      height,
      rotate,
      borderColor: strokeColor,
      borderWidth: strokeWidth,
      color: fillColor,
      opacity,
      borderOpacity: opacity,
    });
    return;
  }

  if (element.type === 'ellipse') {
    const center = mapper.toPagePoint(x + w / 2, y + h / 2);
    page.drawEllipse({
      x: center.x,
      y: center.y,
      xScale: width / 2,
      yScale: height / 2,
      rotate,
      borderColor: strokeColor,
      borderWidth: strokeWidth,
      color: fillColor,
      opacity,
      borderOpacity: opacity,
    });
    return;
  }

  if (element.type === 'line') {
    const isFlipped = element.flip === true;
    page.drawLine({
      start: mapper.toPagePoint(x, isFlipped ? y + h : y),
      end: mapper.toPagePoint(x + w, isFlipped ? y : y + h),
      thickness: Math.max(strokeWidth, 0.25),
      color: strokeColor,
      opacity,
    });
    return;
  }

  if (element.type === 'image') {
    const image = await getImage(element.imageKey);
    page.drawImage(image, { x: origin.x, y: origin.y, width, height, rotate, opacity });
    return;
  }

  throw new AppError('Unsupported element type', HTTP.BAD_REQUEST);
};

const annotateDocument = async ({ documentId, pages, images, asCopy, uploadedBy }) => {
  const documentItem = await requireDocument(documentId);
  if (!isPdfMimeType(documentItem.mimeType)) throw new AppError('Only PDF files can be edited', HTTP.BAD_REQUEST);

  const pdf = await PDFDocument.load(await downloadPdfBufferFromS3(documentItem.s3Key));
  const fontCache = new Map();
  const imageCache = new Map();

  const getFont = async (family, isBold, isItalic) => {
    const names = PDF_FONT_FAMILIES[family] || PDF_FONT_FAMILIES.Helvetica;
    let fontName = names.regular;
    if (isBold && isItalic) fontName = names.boldItalic;
    else if (isBold) fontName = names.bold;
    else if (isItalic) fontName = names.italic;
    if (!fontCache.has(fontName)) fontCache.set(fontName, await pdf.embedFont(fontName));
    return fontCache.get(fontName);
  };

  const getImage = async (imageKey) => {
    if (imageCache.has(imageKey)) return imageCache.get(imageKey);
    const dataUrl = images?.[imageKey];
    const prefix = typeof dataUrl === 'string' ? IMAGE_DATA_URL_PREFIX.exec(dataUrl) : null;
    if (!prefix) throw new AppError('Invalid image data', HTTP.BAD_REQUEST);
    const bytes = Buffer.from(dataUrl.slice(prefix[0].length), 'base64');
    const embedded = prefix[1] === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    imageCache.set(imageKey, embedded);
    return embedded;
  };

  let annotationCount = 0;
  for (const pageEntry of pages) {
    const pageNumber = Number(pageEntry?.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.getPageCount()) {
      throw new AppError('Invalid page number', HTTP.BAD_REQUEST);
    }
    const page = pdf.getPage(pageNumber - 1);
    const mapper = buildPageMapper(page);
    const elements = Array.isArray(pageEntry.elements) ? pageEntry.elements : [];
    for (const element of elements) {
      annotationCount += 1;
      if (annotationCount > MAXIMUM_ANNOTATIONS) throw new AppError('Too many elements', HTTP.BAD_REQUEST);
      await drawAnnotation({ page, mapper, element, getFont, getImage });
    }
  }
  if (annotationCount === 0) throw new AppError('Nothing to save', HTTP.BAD_REQUEST);

  const pdfBytes = await pdf.save();

  if (asCopy) {
    const copiedDocument = await saveGeneratedPdf({
      pdfBytes,
      sourceType: documentItem.sourceType,
      sourceId: documentItem.sourceId,
      displayName: `${documentItem.displayName} (Edited)`,
      folderId: documentItem.folderId,
      area: documentItem.area || 'all',
      issueDate: documentItem.issueDate,
      expiryDate: documentItem.expiryDate,
      uploadedBy,
    });
    refreshDashboard();
    return { status: HTTP.CREATED, message: 'Edited copy saved', data: await serializeDocument(copiedDocument) };
  }

  await uploadPdfBytesToS3(pdfBytes, documentItem.s3Key);
  await documentModel.updateOne({ _id: documentItem._id }, { $set: { fileSize: pdfBytes.length } });
  const updatedDocument = await documentModel.findById(documentItem._id);
  refreshDashboard();
  return { status: HTTP.OK, message: 'Document updated', data: await serializeDocument(updatedDocument) };
};

module.exports = {
  searchDocuments,
  annotateDocument,
  getStorageSummary,
  setRenewalStatus,
  moveFolder,
  copyFolder,
  editDocumentPages,
  mergeDocumentPages,
  copyDocument,
  getFoldersBySource,
  createFolder,
  renameFolder,
  moveDocument,
  getDocumentsBySource,
  registerUploadedDocuments,
  renewDocument,
  updateDocumentDates,
  renameDocument,
  mergeDocuments,
  splitDocument,
};