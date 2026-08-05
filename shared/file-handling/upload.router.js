const express = require('express');
const router = express.Router();
const UploadController = require('./upload.controller');

router.post('/initiate', UploadController.initiateUpload);
router.post('/:sessionId/parts', UploadController.getPartUrls);
router.post('/:sessionId/parts/ack', UploadController.acknowledgePart);
router.post('/:sessionId/complete', UploadController.completeUpload);
router.delete('/:sessionId', UploadController.abortUpload);
router.get('/:sessionId', UploadController.getUploadStatus);

module.exports = router;