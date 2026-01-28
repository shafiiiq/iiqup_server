const documentServices = require('../services/document-services');

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
      expiry
    } = req.body;

    // Validate required fields
    if (!sourceId || !sourceType || !documentType) {
      return res.status(400).json({
        status: 400,
        message: 'Source ID, Source Type, and Document Type are required'
      });
    }

    if (!fileName) {
      return res.status(400).json({
        status: 400,
        message: 'File name is required'
      });
    }

    // Validate sourceType
    const validSourceTypes = ['equipment', 'operator', 'mechanic', 'office-staff'];
    if (!validSourceTypes.includes(sourceType)) {
      return res.status(400).json({
        status: 400,
        message: 'Invalid source type. Must be: equipment, operator, mechanic, or office-staff'
      });
    }

    // Save to database and get presigned URL
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

    res.status(200).json({
      status: 200,
      message: 'Presigned URL generated successfully',
      uploadUrl: result.uploadUrl,
      document: {
        filename: result.finalFilename,
        path: result.s3Key,
        type: documentType
      }
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to generate upload URL',
      error: err.message
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    const { type, id } = req.params;

    // Validate parameters
    if (!type || !id) {
      return res.status(400).json({
        status: 400,
        message: 'Type and ID are required'
      });
    }

    // Validate type
    const validTypes = ['equipment', 'operator', 'mechanic', 'office-staff'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 400,
        message: 'Invalid type. Must be: equipment, operator, mechanic, or office-staff'
      });
    }

    // Get documents
    const result = await documentServices.getDocuments(type, id);

    res.status(result.status).json(result);
  } catch (err) {
    console.error('Get Documents Error:', err);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: err.message
    });
  }
};

const getAllDocuments = async (req, res) => {
  try {
    const result = await documentServices.getAllDocuments();
    res.status(result.status).json(result);
  } catch (err) {
    console.error('Get Documents Error:', err);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: err.message
    });
  }
};

const getAllDocumentsTypes = async (req, res) => {
  try {
    const result = await documentServices.getAllDocumentsTypes();
    res.status(result.status).json(result);
  } catch (err) {
    console.error('Get Documents Error:', err);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: err.message
    });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID is required'
      });
    }

    const result = await documentServices.getDocumentById(documentId);

    if (result.status !== 200) {
      return res.status(result.status).json(result);
    }

    return res.status(result.status).json(result);

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to download document',
      error: err.message
    });
  }
};

const viewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID is required'
      });
    }

    const result = await documentServices.getDocumentById(documentId);

    if (result.status !== 200) {
      return res.status(result.status).json(result);
    }

    res.status(200).json(result);

  } catch (err) {
    console.error('View error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to view document',
      error: err.message
    });
  }
};

const mergePDFs = async (req, res) => {
  try {
    const { sourceId, sourceType, documentIds, category, documentType } = req.body;

    // Validate inputs
    if (!sourceId || !sourceType || !documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return res.status(400).json({
        status: 400,
        message: 'Source ID, Source Type, and at least 2 document IDs are required'
      });
    }

    if (!category || !documentType) {
      return res.status(400).json({
        status: 400,
        message: 'Category and Document Type are required'
      });
    }

    const result = await documentServices.mergePDFs(sourceId, sourceType, documentIds, category, documentType);

    res.status(result.status).json(result);

  } catch (err) {
    console.error('Merge PDFs Error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to merge PDFs',
      error: err.message
    });
  }
};

const splitPDF = async (req, res) => {
  try {
    const { sourceId, sourceType, documentId, splitOptions, category } = req.body;

    // Validate inputs
    if (!sourceId || !sourceType || !documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Source ID, Source Type, and Document ID are required'
      });
    }

    if (!splitOptions || !splitOptions.pages || !Array.isArray(splitOptions.pages)) {
      return res.status(400).json({
        status: 400,
        message: 'Split options with page numbers array is required'
      });
    }

    if (!category) {
      return res.status(400).json({
        status: 400,
        message: 'Category is required'
      });
    }

    const result = await documentServices.splitPDF(sourceId, sourceType, documentId, splitOptions, category);

    res.status(result.status).json(result);

  } catch (err) {
    console.error('Split PDF Error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to split PDF',
      error: err.message
    });
  }
};

const renameFile = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { newFileName } = req.body;

    if (!documentId || !newFileName) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID and new file name are required'
      });
    }

    // Validate filename (no special characters except - and _)
    const validFilename = /^[a-zA-Z0-9-_ ]+$/.test(newFileName);
    if (!validFilename) {
      return res.status(400).json({
        status: 400,
        message: 'Invalid file name. Only letters, numbers, spaces, hyphens and underscores are allowed'
      });
    }

    const result = await documentServices.renameFile(documentId, newFileName);

    res.status(result.status).json(result);

  } catch (err) {
    console.error('Rename file error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to rename file',
      error: err.message
    });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID is required'
      });
    }

    const result = await documentServices.deleteDocument(documentId);

    res.status(result.status).json(result);

  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to delete document',
      error: err.message
    });
  }
};


module.exports = {
  uploadDocument,
  getDocuments,
  downloadDocument,
  viewDocument,
  getAllDocuments,
  getAllDocumentsTypes,
  mergePDFs,
  splitPDF,
  renameFile,
  deleteDocument
};