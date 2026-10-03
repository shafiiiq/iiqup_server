const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const documentService = require('./document.service');
const { SUPPORTED_SOURCE_TYPES, isValidDateInput } = require('./document.helper');

const MAXIMUM_DISPLAY_NAME_LENGTH = 150;
const SPLIT_TYPES = ['specific', 'every'];

const handleRoute = (logTag, handler) => async (req, res) => {
  try {
    const result = await handler(req);
    sendSuccess(res, result);
  } catch (error) {
    logger.error(`[document.controller] ${logTag}`, error);
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const assertSourceType = (sourceType) => {
  if (!SUPPORTED_SOURCE_TYPES.includes(sourceType)) {
    throw new AppError(`Invalid source type. Must be: ${SUPPORTED_SOURCE_TYPES.join(', ')}`, HTTP.BAD_REQUEST);
  }
};

const assertDateRange = (issueDate, expiryDate) => {
  if (!isValidDateInput(issueDate) || !isValidDateInput(expiryDate)) {
    throw new AppError('Dates must be valid', HTTP.BAD_REQUEST);
  }
  if (issueDate && expiryDate && new Date(expiryDate) < new Date(issueDate)) {
    throw new AppError('Expiry date cannot be before issue date', HTTP.BAD_REQUEST);
  }
};

const getDocumentsBySource = handleRoute('getDocumentsBySource', async (req) => {
  const { sourceType, sourceId } = req.params;
  assertSourceType(sourceType);
  return documentService.getDocumentsBySource({ sourceType, sourceId });
});

const registerUploadedDocuments = handleRoute('registerUploadedDocuments', async (req) => {
  const { sourceType, sourceId, sessionIds, folderId } = req.body;
  assertSourceType(sourceType);
  if (!sourceId || !Array.isArray(sessionIds) || sessionIds.length === 0) {
    throw new AppError('sourceId and sessionIds are required', HTTP.BAD_REQUEST);
  }
  return documentService.registerUploadedDocuments({
    sourceType,
    sourceId,
    sessionIds,
    folderId: folderId || null,
    uploadedBy: req.userId,
  });
});

const renewDocument = handleRoute('renewDocument', async (req) => {
  const { documentId } = req.params;
  const { uploadSessionId, issueDate, expiryDate } = req.body;
  if (!uploadSessionId) throw new AppError('uploadSessionId is required', HTTP.BAD_REQUEST);
  assertDateRange(issueDate, expiryDate);
  return documentService.renewDocument({ documentId, uploadSessionId, issueDate, expiryDate, uploadedBy: req.userId });
});

const updateDocumentDates = handleRoute('updateDocumentDates', async (req) => {
  const { documentId } = req.params;
  const { issueDate, expiryDate } = req.body;
  assertDateRange(issueDate, expiryDate);
  return documentService.updateDocumentDates({ documentId, issueDate, expiryDate });
});

const renameDocument = handleRoute('renameDocument', async (req) => {
  const { documentId } = req.params;
  const newFileName = String(req.body.newFileName || '').trim();
  if (!newFileName || newFileName.length > MAXIMUM_DISPLAY_NAME_LENGTH || /[\\/]/.test(newFileName)) {
    throw new AppError('Invalid file name', HTTP.BAD_REQUEST);
  }
  return documentService.renameDocument({ documentId, newFileName });
});

const deleteDocument = handleRoute('deleteDocument', async (req) =>
  documentService.deleteDocument({ documentId: req.params.documentId })
);

const mergeDocuments = handleRoute('mergeDocuments', async (req) => {
  const { sourceType, sourceId, documentIds } = req.body;
  assertSourceType(sourceType);
  if (!sourceId || !Array.isArray(documentIds) || documentIds.length < 2) {
    throw new AppError('sourceId and at least 2 documentIds are required', HTTP.BAD_REQUEST);
  }
  return documentService.mergeDocuments({ sourceType, sourceId, documentIds, uploadedBy: req.userId });
});

const splitDocument = handleRoute('splitDocument', async (req) => {
  const { documentId } = req.params;
  const { splitType, pages } = req.body;
  if (!SPLIT_TYPES.includes(splitType)) throw new AppError('Invalid split type', HTTP.BAD_REQUEST);
  if (splitType === 'specific' && (!Array.isArray(pages) || pages.length === 0)) {
    throw new AppError('pages array is required', HTTP.BAD_REQUEST);
  }
  return documentService.splitDocument({ documentId, splitType, pages: pages || [], uploadedBy: req.userId });
});

const MAXIMUM_FOLDER_NAME_LENGTH = 100;

const normalizeFolderName = (value) => {
  const folderName = String(value || '').trim();
  if (!folderName || folderName.length > MAXIMUM_FOLDER_NAME_LENGTH || /[\\/]/.test(folderName)) {
    throw new AppError('Invalid folder name', HTTP.BAD_REQUEST);
  }
  return folderName;
};

const getFoldersBySource = handleRoute('getFoldersBySource', async (req) => {
  const { sourceType, sourceId } = req.params;
  assertSourceType(sourceType);
  return documentService.getFoldersBySource({ sourceType, sourceId });
});

const createFolder = handleRoute('createFolder', async (req) => {
  const { sourceType, sourceId, parentFolderId } = req.body;
  assertSourceType(sourceType);
  if (!sourceId) throw new AppError('sourceId is required', HTTP.BAD_REQUEST);
  return documentService.createFolder({
    sourceType,
    sourceId,
    parentFolderId: parentFolderId || null,
    name: normalizeFolderName(req.body.name),
  });
});

const renameFolder = handleRoute('renameFolder', async (req) =>
  documentService.renameFolder({ folderId: req.params.folderId, name: normalizeFolderName(req.body.name) })
);

const copyDocument = handleRoute('copyDocument', async (req) =>
  documentService.copyDocument({
    documentId: req.params.documentId,
    folderId: req.body.folderId || null,
    uploadedBy: req.userId,
  })
);

const moveDocument = handleRoute('moveDocument', async (req) =>
  documentService.moveDocument({ documentId: req.params.documentId, folderId: req.body.folderId || null })
);

const moveFolder = handleRoute('moveFolder', async (req) =>
  documentService.moveFolder({
    folderId: req.params.folderId,
    parentFolderId: req.body.parentFolderId || null,
  })
);

const copyFolder = handleRoute('copyFolder', async (req) =>
  documentService.copyFolder({
    folderId: req.params.folderId,
    parentFolderId: req.body.parentFolderId || null,
    uploadedBy: req.userId,
  })
);

const deleteFolder = handleRoute('deleteFolder', async (req) =>
  documentService.deleteFolder({ folderId: req.params.folderId })
);

const editDocumentPages = handleRoute('editDocumentPages', async (req) => {
  const { pages } = req.body;
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new AppError('pages array is required', HTTP.BAD_REQUEST);
  }
  return documentService.editDocumentPages({ documentId: req.params.documentId, pages });
});

const mergeDocumentPages = handleRoute('mergeDocumentPages', async (req) => {
  const { sourceType, sourceId, pages } = req.body;
  assertSourceType(sourceType);
  if (!sourceId || !Array.isArray(pages) || pages.length === 0) {
    throw new AppError('sourceId and pages are required', HTTP.BAD_REQUEST);
  }
  return documentService.mergeDocumentPages({ sourceType, sourceId, pages, uploadedBy: req.userId });
});

module.exports = {
  moveFolder,
  copyFolder,
  deleteFolder,
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
  deleteDocument,
  mergeDocuments,
  splitDocument,
};