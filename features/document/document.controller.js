const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
const documentServices = require('./document.service');
const paginationMiddleware = require('../../shared/pagination/pagination.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SOURCE_TYPES = [
  'equipment',
  'operator',
  'mechanic',
  'office-staff',
];

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /upload-document
 * Saves document metadata and returns a pre-signed S3 upload URL.
 */
const uploadDocument = async (req, res) => {
  try {
    const {
      sourceId,
      sourceType,
      documentType,
      description,
      category,
      fileName,
      mimeType,
      date,
      expiry,
    } = req.body;

    if (!sourceId || !sourceType || !documentType) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'Source ID, Source Type, and Document Type are required',
      });
    }

    if (!fileName) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'File name is required' });
    }

    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: `Invalid source type. Must be: ${VALID_SOURCE_TYPES.join(', ')}`,
      });
    }

    const result = await documentServices.saveDocument(
      sourceId,
      sourceType,
      documentType,
      { fileName, mimeType },
      description,
      category,
      date,
      expiry
    );

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Presigned URL generated successfully',
      uploadUrl: result.uploadUrl,
      document: {
        filename: result.finalFilename,
        path: result.s3Key,
        type: documentType,
      },
    });
  } catch (err) {
    logger.error('[Document] uploadDocument:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to generate upload URL',
      error: err.message,
    });
  }
};

/**
 * GET /get-documents/:type/:id
 * Returns all documents for a given source type and ID.
 */
const getDocuments = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!type || !id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'Type and ID are required' });
    }

    if (!VALID_SOURCE_TYPES.includes(type)) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: `Invalid type. Must be: ${VALID_SOURCE_TYPES.join(', ')}`,
      });
    }

    const result = await documentServices.getDocuments(type, id, req.pagination);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] getDocuments:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

/**
 * GET /get-all-documents
 * Returns all document records.
 */
const getAllDocuments = async (req, res) => {
  try {
    const result = await documentServices.getAllDocuments(req.pagination);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] getAllDocuments:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

/**
 * GET /get-all-documents-types
 * Returns all available document types.
 */
const getAllDocumentsTypes = async (req, res) => {
  try {
    const result = await documentServices.getAllDocumentsTypes(req.pagination);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] getAllDocumentsTypes:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

/**
 * GET /download/:documentId
 * Returns a pre-signed S3 download URL for a document.
 */
const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }

    const result = await documentServices.getDocumentById(documentId);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] downloadDocument:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to download document',
      error: err.message,
    });
  }
};

/**
 * GET /view/:documentId
 * Returns document data for inline viewing.
 */
const viewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }

    const result = await documentServices.getDocumentById(documentId);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] viewDocument:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to view document',
      error: err.message,
    });
  }
};

/**
 * POST /merge-pdfs
 * Merges multiple PDF documents into one.
 */
const mergePDFs = async (req, res) => {
  try {
    const { sourceId, sourceType, documentIds, category, documentType } =
      req.body;

    if (
      !sourceId ||
      !sourceType ||
      !Array.isArray(documentIds) ||
      documentIds.length < 2
    ) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message:
          'Source ID, Source Type, and at least 2 document IDs are required',
      });
    }

    if (!category || !documentType) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'Category and Document Type are required',
      });
    }

    const result = await documentServices.mergePDFs(
      sourceId,
      sourceType,
      documentIds,
      category,
      documentType
    );
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] mergePDFs:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to merge PDFs',
      error: err.message,
    });
  }
};

/**
 * POST /split-pdf
 * Splits a PDF document into multiple files by page range.
 */
const splitPDF = async (req, res) => {
  try {
    const { sourceId, sourceType, documentId, splitOptions, category } =
      req.body;

    if (!sourceId || !sourceType || !documentId) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'Source ID, Source Type, and Document ID are required',
      });
    }

    if (!splitOptions || !Array.isArray(splitOptions.pages)) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'Split options with page numbers array is required',
      });
    }

    if (!category) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'Category is required' });
    }

    const result = await documentServices.splitPDF(
      sourceId,
      sourceType,
      documentId,
      splitOptions,
      category
    );
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] splitPDF:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to split PDF',
      error: err.message,
    });
  }
};

/**
 * PUT /rename-file/:documentId
 * Renames a document file. Allows only letters, numbers, spaces, hyphens, and underscores.
 */
const renameFile = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newFileName } = req.body;

    if (!documentId || !newFileName) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'Document ID and new file name are required',
      });
    }

    if (!/^[a-zA-Z0-9-_ ]+$/.test(newFileName)) {
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message:
          'Invalid file name. Only letters, numbers, spaces, hyphens and underscores are allowed',
      });
    }

    const result = await documentServices.renameFile(documentId, newFileName);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] renameFile:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to rename file',
      error: err.message,
    });
  }
};

/**
 * DELETE /delete/:documentId
 * Deletes a document record and its S3 file.
 */
const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'Document ID is required' });
    }

    const result = await documentServices.deleteDocument(documentId);
    sendSuccess(res, result);
  } catch (err) {
    logger.error('[Document] deleteDocument:', err);
    sendSuccess(res, {
      status: HTTP.INTERNAL_SERVER_ERROR,
      message: 'Failed to delete document',
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  uploadDocument,
  getDocuments,
  getAllDocuments,
  getAllDocumentsTypes,
  downloadDocument,
  viewDocument,
  mergePDFs,
  splitPDF,
  renameFile,
  deleteDocument,
};
