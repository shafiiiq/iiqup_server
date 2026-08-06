const express = require('express');
const router = express.Router();

const controller = require('./document.controller');
const { paginationMiddleware } = require('../../shared/pagination');
const { authMiddleware } = require('../../middlewares/jwt.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// Document Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/get-all-documents', authMiddleware, paginationMiddleware, controller.getAllDocuments);
router.get(
  '/get-all-documents-types',
  authMiddleware,
  paginationMiddleware,
  controller.getAllDocumentsTypes
);
router.get('/get-documents/:type/:id', authMiddleware, paginationMiddleware, controller.getDocuments);
router.post('/upload-document', authMiddleware, controller.uploadDocument);
router.put('/rename-file/:documentId', authMiddleware, controller.renameFile);
router.delete('/delete/:documentId', authMiddleware, controller.deleteDocument);

// ── PDF operations ────────────────────────────────────────────────────────────
router.post('/merge-pdfs', authMiddleware, controller.mergePDFs);
router.post('/split-pdf', authMiddleware, controller.splitPDF);

// ── File access ───────────────────────────────────────────────────────────────
router.get(
  '/download/:documentId',
  authMiddleware,
  controller.downloadDocument
);
router.get('/view/:documentId', controller.viewDocument);

module.exports = router;
