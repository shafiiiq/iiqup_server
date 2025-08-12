const documentServices = require('../services/document-services');
const fs = require('fs');
const path = require('path');

const uploadDocument = async (req, res) => {
  try {
    const { regNo, documentType, description, category, fileName, mimeType } = req.body;

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

    console.log(req.body);

    // Save to database and get presigned URL
    const result = await documentServices.saveDocument(regNo, documentType, { fileName, mimeType }, description, category);

    console.log(result);

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

// NEW: Download document endpoint
const downloadDocument = async (req, res) => {

  console.log("not here");
  
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

    const { filePath, filename, mimetype } = result.document;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 404,
        message: 'File not found on server'
      });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', mimetype || 'application/octet-stream');

    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

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

    const { filePath, filename, mimetype } = result.document;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 404,
        message: 'File not found on server'
      });
    }

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (err) {
    console.error('View error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to view document',
      error: err.message
    });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  downloadDocument,
  viewDocument,
  getAllDocuments
};