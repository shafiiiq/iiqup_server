const express = require('express');
const controller = require('./document.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');

const router = express.Router();

router.get('/source/:sourceType/:sourceId', authMiddleware, controller.getDocumentsBySource);
router.post('/register-uploads', authMiddleware, controller.registerUploadedDocuments);
router.post('/merge', authMiddleware, controller.mergeDocuments);
router.post('/merge-pages', authMiddleware, controller.mergeDocumentPages);
router.post('/:documentId/renew', authMiddleware, controller.renewDocument);
router.post('/:documentId/split', authMiddleware, controller.splitDocument);
router.post('/:documentId/edit-pages', authMiddleware, controller.editDocumentPages);
router.put('/:documentId/dates', authMiddleware, controller.updateDocumentDates);
router.put('/:documentId/rename', authMiddleware, controller.renameDocument);
router.get('/folders/:sourceType/:sourceId', authMiddleware, controller.getFoldersBySource);
router.post('/folders', authMiddleware, controller.createFolder);
router.put('/folders/:folderId/rename', authMiddleware, controller.renameFolder);
router.put('/folders/:folderId/move', authMiddleware, controller.moveFolder);
router.post('/folders/:folderId/copy', authMiddleware, controller.copyFolder);
router.delete('/folders/:folderId', authMiddleware, controller.deleteFolder);
router.put('/:documentId/move', authMiddleware, controller.moveDocument);
router.post('/:documentId/copy', authMiddleware, controller.copyDocument);
router.delete('/:documentId', authMiddleware, controller.deleteDocument);

module.exports = router;