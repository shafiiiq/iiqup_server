const express = require('express')
const cdnController = require('./cdn.controller')
const { startVideoPipeline } = require('./cdn.bootstrap')

const router = express.Router()

router.get('/by-source-key', cdnController.getVideoBySourceKey)
router.get('/thumbnail', cdnController.getThumbnailBySourceKey)
router.get('/:assetId/renditions/:renditionName/playback-url', cdnController.getRenditionPlaybackUrl)
router.get('/:assetId/renditions/:renditionName/download-url', cdnController.getRenditionDownloadUrl)
router.get('/:assetId/master.m3u8', cdnController.getMasterPlaylist)
router.get('/:assetId/renditions/:renditionName/index.m3u8', cdnController.getRenditionPlaylist)
router.get('/:assetId', cdnController.getVideoStatus)

startVideoPipeline()

module.exports = router