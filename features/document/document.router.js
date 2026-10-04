const express = require('express');
const controller = require('./document.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');

const router = express.Router();

router.get('/storage', authMiddleware, controller.getStorageSummary);
router.post('/convert', authMiddleware, controller.convertDocuments);
router.get('/trash/sources', authMiddleware, controller.getTrashSources);
router.get('/trash/:sourceType/:sourceId', authMiddleware, controller.getTrashItems);
router.post('/trash', authMiddleware, controller.trashItems);
router.post('/trash/restore', authMiddleware, controller.restoreTrashItems);
router.post('/trash/empty', authMiddleware, controller.emptyTrash);
router.post('/delete-permanently', authMiddleware, controller.deleteItemsPermanently);
router.post('/compress', authMiddleware, controller.compressItems);

router.get('/source/:sourceType/:sourceId', authMiddleware, controller.getDocumentsBySource);
router.post('/register-uploads', authMiddleware, controller.registerUploadedDocuments);
router.post('/merge', authMiddleware, controller.mergeDocuments);
router.post('/merge-pages', authMiddleware, controller.mergeDocumentPages);

router.get('/folders/:sourceType/:sourceId', authMiddleware, controller.getFoldersBySource);
router.post('/folders', authMiddleware, controller.createFolder);
router.put('/folders/:folderId/rename', authMiddleware, controller.renameFolder);
router.put('/folders/:folderId/move', authMiddleware, controller.moveFolder);
router.post('/folders/:folderId/copy', authMiddleware, controller.copyFolder);

router.post('/:documentId/renew', authMiddleware, controller.renewDocument);
router.post('/:documentId/split', authMiddleware, controller.splitDocument);
router.post('/:documentId/edit-pages', authMiddleware, controller.editDocumentPages);
router.post('/:documentId/extract', authMiddleware, controller.extractDocument);
router.get('/:documentId/preview-pdf', authMiddleware, controller.getPreviewPdfUrl);
router.post('/:documentId/copy', authMiddleware, controller.copyDocument);
router.put('/:documentId/dates', authMiddleware, controller.updateDocumentDates);
router.put('/:documentId/rename', authMiddleware, controller.renameDocument);
router.put('/:documentId/renewal-status', authMiddleware, controller.setRenewalStatus);
router.put('/:documentId/move', authMiddleware, controller.moveDocument);

module.exports = router;