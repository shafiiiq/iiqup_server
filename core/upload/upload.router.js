const express = require('express')
const uploadController = require('./upload.controller')
const cdnRouter = require('#core/cdn/cdn.router')
const { startLiveActivityPoller } = require('./liveactivity/liveactivity.poller')

const router = express.Router()

router.use('/videos', cdnRouter)
router.post('/initiate', uploadController.initiateUpload)
router.put('/:sessionId/thumbnail', express.json({ limit: '2mb' }), uploadController.saveThumbnail)
router.put('/:sessionId/live-activity', uploadController.saveLiveActivity)
router.delete('/:sessionId/live-activity', uploadController.clearLiveActivity)
router.post('/:sessionId/parts', uploadController.getPartUrls)
router.post('/:sessionId/parts/ack', uploadController.acknowledgePart)
router.post('/:sessionId/complete', uploadController.completeUpload)
router.delete('/:sessionId', uploadController.abortUpload)
router.get('/:sessionId', uploadController.getUploadStatus)

startLiveActivityPoller()

module.exports = router