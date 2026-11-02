const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const { PLAYLIST_CONTENT_TYPE } = require('./cdn.config')
const cdnService = require('./cdn.service')

const handleJsonRoute = (logTag, fallbackMessage, handler) => async (req, res) => {
  try {
    const { status, message, data } = await handler(req)
    sendSuccess(res, { status, message, data })
  } catch (error) {
    logger.error(`[cdn.controller] ${logTag}:`, error)
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message || fallbackMessage })
  }
}

const handlePlaylistRoute = (logTag, fallbackMessage, loadPlaylist) => async (req, res) => {
  try {
    const playlistText = await loadPlaylist(req)
    res.set('Content-Type', PLAYLIST_CONTENT_TYPE)
    res.set('Cache-Control', 'no-store')
    res.status(HTTP.OK).send(playlistText)
  } catch (error) {
    logger.error(`[cdn.controller] ${logTag}:`, error)
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message || fallbackMessage })
  }
}

const getVideoBySourceKey = handleJsonRoute('getVideoBySourceKey', 'Failed to retrieve video', async (req) => {
  const data = await cdnService.getAssetBySourceKey(req.query.key)
  return { status: HTTP.OK, message: 'Video retrieved', data }
})

const getThumbnailBySourceKey = handleJsonRoute('getThumbnailBySourceKey', 'Failed to retrieve thumbnail', async (req) => {
  const data = await cdnService.getThumbnailBySourceKey(req.query.key)
  return { status: HTTP.OK, message: 'Thumbnail retrieved', data }
})

const getVideoStatus = handleJsonRoute('getVideoStatus', 'Failed to retrieve video status', async (req) => {
  const data = await cdnService.getAssetStatus(req.params.assetId)
  return { status: HTTP.OK, message: 'Video status retrieved', data }
})

const getRenditionPlaybackUrl = handleJsonRoute('getRenditionPlaybackUrl', 'Failed to load playback url', async (req) => {
  const data = await cdnService.getRenditionPlaybackUrl(req.params.assetId, req.params.renditionName)
  return { status: HTTP.OK, message: 'Playback url retrieved', data }
})

const getRenditionDownloadUrl = handleJsonRoute('getRenditionDownloadUrl', 'Failed to load download url', async (req) => {
  const data = await cdnService.getRenditionDownloadUrl(req.params.assetId, req.params.renditionName)
  return { status: HTTP.OK, message: 'Download url retrieved', data }
})

const getMasterPlaylist = handlePlaylistRoute('getMasterPlaylist', 'Failed to load master playlist', (req) =>
  cdnService.getMasterPlaylist(req.params.assetId)
)

const getRenditionPlaylist = handlePlaylistRoute('getRenditionPlaylist', 'Failed to load rendition playlist', (req) =>
  cdnService.getRenditionPlaylist(req.params.assetId, req.params.renditionName)
)

module.exports = {
  getRenditionDownloadUrl,
  getRenditionPlaybackUrl,
  getThumbnailBySourceKey,
  getVideoBySourceKey,
  getVideoStatus,
  getMasterPlaylist,
  getRenditionPlaylist,
}