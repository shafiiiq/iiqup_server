const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const documentService = require('./document.service');
const trashService = require('./document.trash.service');
const archiveService = require('./document.archive.service');
const convertService = require('./document.convert.service');
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

const MAXIMUM_EMPTY_DIRECTORIES = 5000;

const registerUploadedDocuments = handleRoute('registerUploadedDocuments', async (req) => {
  const { sourceType, sourceId, sessionIds, folderId, area, directoryBySessionId, emptyDirectories } = req.body;
  assertSourceType(sourceType);
  if (!sourceId || !Array.isArray(sessionIds) || sessionIds.length === 0) {
    throw new AppError('sourceId and sessionIds are required', HTTP.BAD_REQUEST);
  }
  return documentService.registerUploadedDocuments({
    sourceType,
    sourceId,
    sessionIds,
    folderId: folderId || null,
    area,
    directoryBySessionId: directoryBySessionId && typeof directoryBySessionId === 'object' ? directoryBySessionId : {},
    emptyDirectories: Array.isArray(emptyDirectories)
      ? emptyDirectories.filter((entry) => typeof entry === 'string').slice(0, MAXIMUM_EMPTY_DIRECTORIES)
      : [],
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
  const { sourceType, sourceId, parentFolderId, area } = req.body;
  assertSourceType(sourceType);
  if (!sourceId) throw new AppError('sourceId is required', HTTP.BAD_REQUEST);
  return documentService.createFolder({
    sourceType,
    sourceId,
    parentFolderId: parentFolderId || null,
    area,
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
    area: req.body.area,
    uploadedBy: req.userId,
  })
);

const moveDocument = handleRoute('moveDocument', async (req) =>
  documentService.moveDocument({
    documentId: req.params.documentId,
    folderId: req.body.folderId || null,
    area: req.body.area,
  })
);

const moveFolder = handleRoute('moveFolder', async (req) =>
  documentService.moveFolder({
    folderId: req.params.folderId,
    parentFolderId: req.body.parentFolderId || null,
    area: req.body.area,
  })
);

const copyFolder = handleRoute('copyFolder', async (req) =>
  documentService.copyFolder({
    folderId: req.params.folderId,
    parentFolderId: req.body.parentFolderId || null,
    area: req.body.area,
    uploadedBy: req.userId,
  })
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

const MAXIMUM_BULK_ITEMS = 500;

const parseIdList = (value) => {
  const ids = Array.isArray(value) ? value.map(String) : [];
  if (ids.length > MAXIMUM_BULK_ITEMS) throw new AppError(`At most ${MAXIMUM_BULK_ITEMS} items per request`, HTTP.BAD_REQUEST);
  return ids;
};

const parseSelection = (body) => {
  const documentIds = parseIdList(body.documentIds);
  const folderIds = parseIdList(body.folderIds);
  if (documentIds.length + folderIds.length === 0) throw new AppError('Nothing selected', HTTP.BAD_REQUEST);
  return { documentIds, folderIds };
};

const trashItems = handleRoute('trashItems', async (req) =>
  trashService.trashItems({ ...parseSelection(req.body), deletedBy: req.userId })
);

const getTrashSources = handleRoute('getTrashSources', async () => trashService.getTrashSources());

const getTrashItems = handleRoute('getTrashItems', async (req) => {
  const { sourceType, sourceId } = req.params;
  assertSourceType(sourceType);
  return trashService.getTrashItems({ sourceType, sourceId });
});

const restoreTrashItems = handleRoute('restoreTrashItems', async (req) =>
  trashService.restoreItems(parseSelection(req.body))
);

const deleteItemsPermanently = handleRoute('deleteItemsPermanently', async (req) =>
  trashService.permanentlyDeleteItems(parseSelection(req.body))
);

const emptyTrash = handleRoute('emptyTrash', async (req) => {
  const { sourceType, sourceId } = req.body;
  if (sourceType || sourceId) assertSourceType(sourceType);
  return trashService.emptyTrash({ sourceType, sourceId });
});

const compressItems = handleRoute('compressItems', async (req) => {
  const { sourceType, sourceId, folderId } = req.body;
  assertSourceType(sourceType);
  if (!sourceId) throw new AppError('sourceId is required', HTTP.BAD_REQUEST);
  return archiveService.compressItems({
    sourceType,
    sourceId,
    ...parseSelection(req.body),
    targetFolderId: folderId || null,
    area: req.body.area,
    uploadedBy: req.userId,
  });
});

const extractDocument = handleRoute('extractDocument', async (req) =>
  archiveService.extractDocument({ documentId: req.params.documentId, uploadedBy: req.userId })
);

const RENEWAL_STATUSES = ['none', 'renewed', 'expired'];

const setRenewalStatus = handleRoute('setRenewalStatus', async (req) => {
  const { renewalStatus } = req.body;
  if (!RENEWAL_STATUSES.includes(renewalStatus)) throw new AppError('Invalid renewal status', HTTP.BAD_REQUEST);
  return documentService.setRenewalStatus({ documentId: req.params.documentId, renewalStatus });
});

const getStorageSummary = handleRoute('getStorageSummary', async () => documentService.getStorageSummary());

const convertDocuments = handleRoute('convertDocuments', async (req) => {
  const { sourceType, sourceId, conversion } = req.body;
  assertSourceType(sourceType);
  if (!sourceId) throw new AppError('sourceId is required', HTTP.BAD_REQUEST);
  const { documentIds } = parseSelection({ documentIds: req.body.documentIds, folderIds: [] });
  return convertService.convertDocuments({ sourceType, sourceId, conversion, documentIds, uploadedBy: req.userId });
});

const getPreviewPdfUrl = handleRoute('getPreviewPdfUrl', async (req) =>
  convertService.getPreviewPdfUrl({ documentId: req.params.documentId })
);

module.exports = {
  getStorageSummary,
  convertDocuments,
  getPreviewPdfUrl,
  setRenewalStatus,
  trashItems,
  getTrashSources,
  getTrashItems,
  restoreTrashItems,
  deleteItemsPermanently,
  emptyTrash,
  compressItems,
  extractDocument,
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