const express = require('express');
const router = express.Router();

const controller = require('./document.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.get('/get-all-documents', authMiddleware, paginationMiddleware, controller.getAllDocuments);
router.get('/get-all-documents-types', authMiddleware, paginationMiddleware, controller.getAllDocumentTypes);
router.get('/get-documents/:type/:id', authMiddleware, paginationMiddleware, controller.getDocumentsBySource);
router.post('/upload-document', authMiddleware, controller.uploadDocument);
router.put('/rename-file/:documentId', authMiddleware, controller.renameFile);
router.delete('/delete/:documentId', authMiddleware, controller.deleteDocument);

router.post('/merge-pdfs', authMiddleware, controller.mergePDFs);
router.post('/split-pdf', authMiddleware, controller.splitPDF);

router.get('/download/:documentId', authMiddleware, controller.downloadDocument);
router.get('/view/:documentId', controller.viewDocument);

module.exports = router;