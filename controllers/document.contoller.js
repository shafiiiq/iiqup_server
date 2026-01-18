const documentServices = require('../services/document-services');
const fs = require('fs');
const path = require('path');

const uploadDocument = async (req, res) => {
  try {
    const { regNo, documentType, description, category, fileName, mimeType, date, expiry } = req.body;

    if (!regNo || !documentType) {
      return res.status(400).json({
        status: 400,
        message: 'Registration Number and Document Type are required'
      });
    }

    if (!fileName) {
      return res.status(400).json({
        status: 400,
        message: 'File name is required'
      });
    }

    // Save to database and get presigned URL
    const result = await documentServices.saveDocument(regNo, documentType, { fileName, mimeType }, description, category, date, expiry);

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
    const { regNo } = req.params;

    // Validate registration number
    if (!regNo) {
      return res.status(400).json({
        status: 400,
        message: 'Registration Number is required'
      });
    }

    // Get documents
    const result = await documentServices.getDocuments(regNo);

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
    // Get documents
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
    // Get documents
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


// NEW: Download document endpoint
const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID is required'
      });
    }

    // Get document info from database
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

// NEW: View document endpoint
const viewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Document ID is required'
      });
    }

    // Get document info from database
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
    const { regNo, documentIds, category, documentType } = req.body;

    // Validate inputs
    if (!regNo || !documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return res.status(400).json({
        status: 400,
        message: 'Registration Number and at least 2 document IDs are required'
      });
    }

    if (!category || !documentType) {
      return res.status(400).json({
        status: 400,
        message: 'Category and Document Type are required'
      });
    }

    // Call service to merge PDFs
    const result = await documentServices.mergePDFs(regNo, documentIds, category, documentType);

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

// Split PDF Controller
const splitPDF = async (req, res) => {
  try {
    const { regNo, documentId, splitOptions, category } = req.body;

    // Validate inputs
    if (!regNo || !documentId) {
      return res.status(400).json({
        status: 400,
        message: 'Registration Number and Document ID are required'
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

    // Call service to split PDF
    const result = await documentServices.splitPDF(regNo, documentId, splitOptions, category);

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

module.exports = {
  uploadDocument,
  getDocuments,
  downloadDocument,
  viewDocument,
  getAllDocuments,
  getAllDocumentsTypes,
  mergePDFs,
  splitPDF
};