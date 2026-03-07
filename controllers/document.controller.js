const documentServices = require('../services/document.service');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SOURCE_TYPES = ['equipment', 'operator', 'mechanic', 'office-staff'];

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /upload-document
 * Saves document metadata and returns a pre-signed S3 upload URL.
 */
const uploadDocument = async (req, res) => {
  try {
    const { sourceId, sourceType, documentType, description, category, fileName, mimeType, date, expiry } = req.body;

    if (!sourceId || !sourceType || !documentType) {
      return res.status(400).json({ status: 400, message: 'Source ID, Source Type, and Document Type are required' });
    }

    if (!fileName) {
      return res.status(400).json({ status: 400, message: 'File name is required' });
    }

    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return res.status(400).json({ status: 400, message: `Invalid source type. Must be: ${VALID_SOURCE_TYPES.join(', ')}` });
    }

    const result = await documentServices.saveDocument(
      sourceId, sourceType, documentType,
      { fileName, mimeType },
      description, category, date, expiry
    );

    res.status(200).json({
      status:    200,
      message:   'Presigned URL generated successfully',
      uploadUrl: result.uploadUrl,
      document:  { filename: result.finalFilename, path: result.s3Key, type: documentType },
    });
  } catch (err) {
    console.error('[Document] uploadDocument:', err);
    res.status(500).json({ status: 500, message: 'Failed to generate upload URL', error: err.message });
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
      return res.status(400).json({ status: 400, message: 'Type and ID are required' });
    }

    if (!VALID_SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ status: 400, message: `Invalid type. Must be: ${VALID_SOURCE_TYPES.join(', ')}` });
    }

    const result = await documentServices.getDocuments(type, id);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] getDocuments:', err);
    res.status(500).json({ status: 500, message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /get-all-documents
 * Returns all document records.
 */
const getAllDocuments = async (req, res) => {
  try {
    const result = await documentServices.getAllDocuments();
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] getAllDocuments:', err);
    res.status(500).json({ status: 500, message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /get-all-documents-types
 * Returns all available document types.
 */
const getAllDocumentsTypes = async (req, res) => {
  try {
    const result = await documentServices.getAllDocumentsTypes();
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] getAllDocumentsTypes:', err);
    res.status(500).json({ status: 500, message: 'Internal server error', error: err.message });
  }
};

/**
 * GET /download/:documentId
 * Returns a pre-signed S3 download URL for a document.
 */
const downloadDocument = async (req, res) => {
  try {
    console.log("hiiiiiiiiiiiiiiii")
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ status: 400, message: 'Document ID is required' });
    }

    const result = await documentServices.getDocumentById(documentId);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] downloadDocument:', err);
    res.status(500).json({ status: 500, message: 'Failed to download document', error: err.message });
  }
};

/**
 * GET /view/:documentId
 * Returns document data for inline viewing.
 */
const viewDocument = async (req, res) => {
  try {
    console.log("fffffffffffffffff")
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ status: 400, message: 'Document ID is required' });
    }

    const result = await documentServices.getDocumentById(documentId);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] viewDocument:', err);
    res.status(500).json({ status: 500, message: 'Failed to view document', error: err.message });
  }
};

/**
 * POST /merge-pdfs
 * Merges multiple PDF documents into one.
 */
const mergePDFs = async (req, res) => {
  try {
    const { sourceId, sourceType, documentIds, category, documentType } = req.body;

    if (!sourceId || !sourceType || !Array.isArray(documentIds) || documentIds.length < 2) {
      return res.status(400).json({ status: 400, message: 'Source ID, Source Type, and at least 2 document IDs are required' });
    }

    if (!category || !documentType) {
      return res.status(400).json({ status: 400, message: 'Category and Document Type are required' });
    }

    const result = await documentServices.mergePDFs(sourceId, sourceType, documentIds, category, documentType);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] mergePDFs:', err);
    res.status(500).json({ status: 500, message: 'Failed to merge PDFs', error: err.message });
  }
};

/**
 * POST /split-pdf
 * Splits a PDF document into multiple files by page range.
 */
const splitPDF = async (req, res) => {
  try {
    const { sourceId, sourceType, documentId, splitOptions, category } = req.body;

    if (!sourceId || !sourceType || !documentId) {
      return res.status(400).json({ status: 400, message: 'Source ID, Source Type, and Document ID are required' });
    }

    if (!splitOptions || !Array.isArray(splitOptions.pages)) {
      return res.status(400).json({ status: 400, message: 'Split options with page numbers array is required' });
    }

    if (!category) {
      return res.status(400).json({ status: 400, message: 'Category is required' });
    }

    const result = await documentServices.splitPDF(sourceId, sourceType, documentId, splitOptions, category);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] splitPDF:', err);
    res.status(500).json({ status: 500, message: 'Failed to split PDF', error: err.message });
  }
};

/**
 * PUT /rename-file/:documentId
 * Renames a document file. Allows only letters, numbers, spaces, hyphens, and underscores.
 */
const renameFile = async (req, res) => {
  try {
    const { documentId }  = req.params;
    const { newFileName } = req.body;

    if (!documentId || !newFileName) {
      return res.status(400).json({ status: 400, message: 'Document ID and new file name are required' });
    }

    if (!/^[a-zA-Z0-9-_ ]+$/.test(newFileName)) {
      return res.status(400).json({ status: 400, message: 'Invalid file name. Only letters, numbers, spaces, hyphens and underscores are allowed' });
    }

    const result = await documentServices.renameFile(documentId, newFileName);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] renameFile:', err);
    res.status(500).json({ status: 500, message: 'Failed to rename file', error: err.message });
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
      return res.status(400).json({ status: 400, message: 'Document ID is required' });
    }

    const result = await documentServices.deleteDocument(documentId);
    res.status(result.status).json(result);
  } catch (err) {
    console.error('[Document] deleteDocument:', err);
    res.status(500).json({ status: 500, message: 'Failed to delete document', error: err.message });
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