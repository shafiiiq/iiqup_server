const express = require('express');
const documentController = require('../controllers/document.contoller');
const { authMiddleware } = require('../utils/jwt');
const router = express.Router();

router.post('/upload-document', authMiddleware, documentController.uploadDocument);
router.get('/get-documents/:type/:id', authMiddleware, documentController.getDocuments);
router.get('/get-all-documents', authMiddleware, documentController.getAllDocuments);
router.get('/get-all-documents-types', authMiddleware, documentController.getAllDocumentsTypes);
router.post('/merge-pdfs', authMiddleware, documentController.mergePDFs);
router.post('/split-pdf', authMiddleware, documentController.splitPDF);
router.get('/download/:documentId', authMiddleware, documentController.downloadDocument);
router.get('/view/:documentId', documentController.viewDocument);
router.put('/rename-file/:documentId', authMiddleware, documentController.renameFile);
router.delete('/delete/:documentId', authMiddleware, documentController.deleteDocument);

module.exports = router;