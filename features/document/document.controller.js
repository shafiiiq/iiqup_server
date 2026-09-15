const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const documentService = require('./document.service');

const SUPPORTED_SOURCE_TYPES = ['equipment', 'operator', 'mechanic', 'staff'];

const uploadDocument = async (req, res) => {
  try {
    const { sourceId, sourceType, documentType, description, category, fileName, mimeType, date, expiry } = req.body;

    if (!sourceId || !sourceType || !documentType) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'Source ID, Source Type, and Document Type are required' });
    }
    if (!fileName) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'File name is required' });
    }
    if (!SUPPORTED_SOURCE_TYPES.includes(sourceType)) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: `Invalid source type. Must be: ${SUPPORTED_SOURCE_TYPES.join(', ')}` });
    }

    const result = await documentService.saveDocument(sourceId, sourceType, documentType, { fileName, mimeType }, description, category, date, expiry);

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Presigned URL generated successfully',
      uploadUrl: result.uploadUrl,
      document: { filename: result.finalFilename, path: result.s3Key, type: documentType },
    });
  } catch (error) {
    logger.error('[document.controller] uploadDocument', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to generate upload URL', error: error.message });
  }
};

const getDocumentsBySource = async (req, res) => {
  try {
    const { type: sourceType, id: sourceId } = req.params;

    if (!sourceType || !sourceId) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'Type and ID are required' });
    }
    if (!SUPPORTED_SOURCE_TYPES.includes(sourceType)) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: `Invalid type. Must be: ${SUPPORTED_SOURCE_TYPES.join(', ')}` });
    }

    const result = await documentService.getDocumentsBySource(sourceType, sourceId, req.pagination);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] getDocumentsBySource', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Internal server error', error: error.message });
  }
};

const getAllDocuments = async (req, res) => {
  try {
    const result = await documentService.getAllDocuments(req.pagination);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] getAllDocuments', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Internal server error', error: error.message });
  }
};

const getAllDocumentTypes = async (req, res) => {
  try {
    const result = await documentService.getAllDocumentTypes(req.pagination);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] getAllDocumentTypes', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Internal server error', error: error.message });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }
    const result = await documentService.getDocumentFileById(documentId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] downloadDocument', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to download document', error: error.message });
  }
};

const viewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }
    const result = await documentService.getDocumentFileById(documentId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] viewDocument', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to view document', error: error.message });
  }
};

const mergePDFs = async (req, res) => {
  try {
    const { sourceId, sourceType, documentIds, category, documentType } = req.body;

    if (!sourceId || !sourceType || !Array.isArray(documentIds) || documentIds.length < 2) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Source ID, Source Type, and at least 2 document IDs are required' });
    }
    if (!category || !documentType) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Category and Document Type are required' });
    }

    const result = await documentService.mergePDFs(sourceId, sourceType, documentIds, category, documentType);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] mergePDFs', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to merge PDFs', error: error.message });
  }
};

const splitPDF = async (req, res) => {
  try {
    const { sourceId, sourceType, documentId, splitOptions, category } = req.body;

    if (!sourceId || !sourceType || !documentId) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Source ID, Source Type, and Document ID are required' });
    }
    if (!splitOptions || !Array.isArray(splitOptions.pages)) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Split options with page numbers array is required' });
    }
    if (!category) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'Category is required' });
    }

    const result = await documentService.splitPDF(sourceId, sourceType, documentId, splitOptions, category);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] splitPDF', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to split PDF', error: error.message });
  }
};

const renameFile = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newFileName } = req.body;

    if (!documentId || !newFileName) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Document ID and new file name are required' });
    }
    if (!/^[a-zA-Z0-9-_ ]+$/.test(newFileName)) {
      return sendSuccess(res, { status: HTTP.BAD_REQUEST, message: 'Invalid file name. Only letters, numbers, spaces, hyphens and underscores are allowed' });
    }

    const result = await documentService.renameFile(documentId, newFileName);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] renameFile', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to rename file', error: error.message });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(HTTP.BAD_REQUEST).json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }
    const result = await documentService.deleteDocument(documentId);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[document.controller] deleteDocument', error);
    sendSuccess(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to delete document', error: error.message });
  }
};

module.exports = {
  uploadDocument,
  getDocumentsBySource,
  getAllDocuments,
  getAllDocumentTypes,
  downloadDocument,
  viewDocument,
  mergePDFs,
  splitPDF,
  renameFile,
  deleteDocument,
};