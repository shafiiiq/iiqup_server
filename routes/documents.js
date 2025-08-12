const express = require('express');
const documentController = require('../controllers/document.contoller')
const { authMiddleware } = require('../utils/jwt');
const router = express.Router();

router.post('/upload-document', authMiddleware, documentController.uploadDocument);
router.get('/get-documents/:regNo', authMiddleware, documentController.getDocuments);
router.get('/get-all-documents', authMiddleware, documentController.getAllDocuments);

// Add these new endpoints
router.get('/download/:documentId', authMiddleware, documentController.downloadDocument);
router.get('/view/:documentId', documentController.viewDocument);

module.exports = router;