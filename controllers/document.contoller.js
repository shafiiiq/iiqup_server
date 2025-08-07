const documentServices = require('../services/document-services');
const fs = require('fs');
const path = require('path');

const formatDateTime = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);
  
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  hours = String(hours).padStart(2, '0');
  
  return `${day}-${month}-${year}-${hours}${minutes}${ampm}`;
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 400,
        message: 'No file uploaded'
      });
    }

    console.log(req.body);
    

    const { regNo, documentType, description, category } = req.body;

    if (!regNo || !documentType) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        status: 400,
        message: 'Registration Number and Document Type are required'
      });
    }

    // Create final directory structure
    const finalDir = path.join(__dirname, '../public/documents', regNo, documentType);
    fs.mkdirSync(finalDir, { recursive: true });

    // Generate final filename
    const ext = path.extname(req.file.originalname);
    const finalFilename = `${regNo}-${documentType}-${formatDateTime()}${ext}`;
    const finalPath = path.join(finalDir, finalFilename);

    // Move file from temp to final location
    fs.renameSync(req.file.path, finalPath);

    // Update file object
    req.file.filename = finalFilename;
    req.file.path = finalPath;

    // Save to database
    const result = await documentServices.saveDocument(regNo, documentType, req.file, description, category);

    res.status(200).json({
      status: 200,
      message: 'Document uploaded successfully',
      document: {
        filename: finalFilename,
        path: `/documents/${regNo}/${documentType}/${finalFilename}`,
        type: documentType
      }
    });

  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    console.error('Upload error:', err);
    res.status(500).json({
      status: 500,
      message: 'Failed to upload document',
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