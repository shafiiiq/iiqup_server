const mongoose = require('mongoose');
const { PDFDocument } = require('pdf-lib');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { deleteObject, copyObject } = require('#core/s3/s3.config');
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
  const documentItem = await documentModel.findById(documentId);
  if (!documentItem) throw new AppError('Document not found', HTTP.NOT_FOUND);
  return documentItem;
};

const serializeFolder = (folderItem) => ({
  _id: folderItem._id.toString(),
  sourceType: folderItem.sourceType,
  sourceId: folderItem.sourceId,
  parentFolderId: folderItem.parentFolderId ? folderItem.parentFolderId.toString() : null,
  name: folderItem.name,
});

const requireFolder = async (folderId, sourceType, sourceId) => {
  if (!mongoose.isValidObjectId(folderId)) throw new AppError('Invalid folder ID', HTTP.BAD_REQUEST);
  const folderItem = await documentFolderModel.findOne({ _id: folderId, sourceType, sourceId });
  if (!folderItem) throw new AppError('Folder not found', HTTP.NOT_FOUND);
  return folderItem;
};

const assertFolderNameAvailable = async ({ sourceType, sourceId, parentFolderId, name, excludeFolderId }) => {
  const filter = { sourceType, sourceId, parentFolderId, name };
  if (excludeFolderId) filter._id = { $ne: excludeFolderId };
  const existingFolder = await documentFolderModel.exists(filter).collation({ locale: 'en', strength: 2 });
  if (existingFolder) throw new AppError('A folder with this name already exists here', HTTP.CONFLICT);
};

const assertSessionBelongsToSource = (session, sourceType, sourceId) => {
  if (session.context !== sourceType || session.entityId !== sourceId) {
    throw new AppError('Upload session does not belong to this source', HTTP.BAD_REQUEST);
  }
};

const buildDocumentFromSession = (session, uploadedBy, folderId = null) => ({
  folderId,
  sourceType: session.context,
  sourceId: session.entityId,
  displayName: stripFileExtension(session.originalName),
  originalFileName: session.originalName,
  s3Key: session.s3Key,
  mimeType: session.mimeType,
  fileSize: session.fileSize,
  uploadSessionId: session._id.toString(),
  uploadedBy,
});

const saveGeneratedPdf = async ({ pdfBytes, sourceType, sourceId, displayName, issueDate, expiryDate, uploadedBy, folderId = null }) => {
  const s3Key = buildS3Key(DOCUMENT_UPLOAD_FEATURE, buildDocumentKeyPrefix(sourceType, sourceId), 'document.pdf');
  await uploadPdfBytesToS3(pdfBytes, s3Key);
  return documentModel.create({
    folderId,
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
  const documents = await documentModel.find({ sourceType, sourceId }).sort({ createdAt: -1 });
  const data = await Promise.all(documents.map(serializeDocument));
  return { status: HTTP.OK, message: 'Documents retrieved', data };
};

const registerUploadedDocuments = async ({ sourceType, sourceId, sessionIds, uploadedBy, folderId }) => {
  await requireSource(sourceType, sourceId);
  if (folderId) await requireFolder(folderId, sourceType, sourceId);

  const sessions = await getCompletedSessions({ sessionIds, uploadedBy, feature: DOCUMENT_UPLOAD_FEATURE });
  sessions.forEach((session) => assertSessionBelongsToSource(session, sourceType, sourceId));

  const alreadyRegisteredSessionIds = await documentModel.distinct('uploadSessionId', {
    uploadSessionId: { $in: sessionIds },
  });
  const pendingSessions = sessions.filter((session) => !alreadyRegisteredSessionIds.includes(session._id.toString()));

  const createdDocuments = await documentModel.insertMany(
    pendingSessions.map((session) => buildDocumentFromSession(session, uploadedBy, folderId))
  );

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
    ...buildDocumentFromSession(session, uploadedBy, previousDocument.folderId),
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

const deleteDocument = async ({ documentId }) => {
  const documentItem = await requireDocument(documentId);

  try {
    await deleteObject(documentItem.s3Key);
  } catch (storageError) {
    logger.error('[document.service] deleteDocument storage delete failed', storageError);
  }

  await documentModel.deleteOne({ _id: documentItem._id });
  refreshDashboard();
  return { status: HTTP.OK, message: 'Document deleted', data: { _id: documentId } };
};

const mergeDocuments = async ({ sourceType, sourceId, documentIds, uploadedBy }) => {
  await requireSource(sourceType, sourceId);

  const uniqueDocumentIds = [...new Set(documentIds)];
  if (!uniqueDocumentIds.every((documentId) => mongoose.isValidObjectId(documentId))) {
    throw new AppError('Invalid document ID', HTTP.BAD_REQUEST);
  }

  const documents = await documentModel.find({ _id: { $in: uniqueDocumentIds }, sourceType, sourceId });
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

const copyDocument = async ({ documentId, folderId, uploadedBy }) => {
  const sourceDocument = await requireDocument(documentId);
  if (folderId) await requireFolder(folderId, sourceDocument.sourceType, sourceDocument.sourceId);

  const copiedS3Key = buildS3Key(
    DOCUMENT_UPLOAD_FEATURE,
    buildDocumentKeyPrefix(sourceDocument.sourceType, sourceDocument.sourceId),
    sourceDocument.originalFileName
  );
  await copyObject(sourceDocument.s3Key, copiedS3Key);

  const copiedDocument = await documentModel.create({
    folderId: folderId || null,
    sourceType: sourceDocument.sourceType,
    sourceId: sourceDocument.sourceId,
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

const getFoldersBySource = async ({ sourceType, sourceId }) => {
  await requireSource(sourceType, sourceId);
  const folders = await documentFolderModel.find({ sourceType, sourceId }).sort({ name: 1 });
  return { status: HTTP.OK, message: 'Folders retrieved', data: folders.map(serializeFolder) };
};

const createFolder = async ({ sourceType, sourceId, parentFolderId, name }) => {
  await requireSource(sourceType, sourceId);
  if (parentFolderId) await requireFolder(parentFolderId, sourceType, sourceId);
  await assertFolderNameAvailable({ sourceType, sourceId, parentFolderId, name });
  const createdFolder = await documentFolderModel.create({ sourceType, sourceId, parentFolderId, name });
  return { status: HTTP.CREATED, message: 'Folder created', data: serializeFolder(createdFolder) };
};

const renameFolder = async ({ folderId, name }) => {
  if (!mongoose.isValidObjectId(folderId)) throw new AppError('Invalid folder ID', HTTP.BAD_REQUEST);
  const folderItem = await documentFolderModel.findById(folderId);
  if (!folderItem) throw new AppError('Folder not found', HTTP.NOT_FOUND);
  await assertFolderNameAvailable({
    sourceType: folderItem.sourceType,
    sourceId: folderItem.sourceId,
    parentFolderId: folderItem.parentFolderId,
    name,
    excludeFolderId: folderItem._id,
  });
  folderItem.name = name;
  await folderItem.save();
  return { status: HTTP.OK, message: 'Folder renamed', data: serializeFolder(folderItem) };
};

const moveDocument = async ({ documentId, folderId }) => {
  const documentItem = await requireDocument(documentId);
  if (folderId) await requireFolder(folderId, documentItem.sourceType, documentItem.sourceId);
  documentItem.folderId = folderId || null;
  await documentItem.save();
  return { status: HTTP.OK, message: 'Document moved', data: await serializeDocument(documentItem) };
};

module.exports = {
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
  deleteDocument,
  mergeDocuments,
  splitDocument,
};