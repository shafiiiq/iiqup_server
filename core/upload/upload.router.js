const express = require('express')
const uploadController = require('./upload.controller')

const router = express.Router()

router.post('/initiate', uploadController.initiateUpload)
router.post('/:sessionId/parts', uploadController.getPartUrls)
router.post('/:sessionId/parts/ack', uploadController.acknowledgePart)
router.post('/:sessionId/complete', uploadController.completeUpload)
router.delete('/:sessionId', uploadController.abortUpload)
router.get('/:sessionId', uploadController.getUploadStatus)

module.exports = router