const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const uploadService = require('./upload.service')

const handleRoute = (logTag, fallbackMessage, handler) => async (req, res) => {
  try {
    const { status, message, data } = await handler(req)
    sendSuccess(res, { status, message, data })
  } catch (error) {
    logger.error(`[upload.controller] ${logTag}:`, error)
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message || fallbackMessage })
  }
}

const initiateUpload = handleRoute('initiateUpload', 'Failed to initiate upload', async (req) => {
  const { feature, context, entityId, keyPrefix, fileName, mimeType, fileSize } = req.body
  const data = await uploadService.initiateUpload({
    feature,
    context,
    entityId,
    keyPrefix,
    fileName,
    mimeType,
    fileSize,
    uploadedBy: req.userId,
  })
  return { status: HTTP.CREATED, message: 'Upload session created', data }
})

const getPartUrls = handleRoute('getPartUrls', 'Failed to generate part URLs', async (req) => {
  const { sessionId } = req.params
  const { partNumbers } = req.body
  const data = await uploadService.getPartUrls({ sessionId, uploadedBy: req.userId, partNumbers })
  return { status: HTTP.OK, message: 'Part URLs generated', data }
})

const acknowledgePart = handleRoute('acknowledgePart', 'Failed to acknowledge part', async (req) => {
  const { sessionId } = req.params
  const { partNumber, etag, size } = req.body
  const data = await uploadService.acknowledgePart({ sessionId, uploadedBy: req.userId, partNumber, etag, size })
  return { status: HTTP.OK, message: 'Part acknowledged', data }
})

const completeUpload = handleRoute('completeUpload', 'Failed to complete upload', async (req) => {
  const { sessionId } = req.params
  const { parts } = req.body
  const data = await uploadService.completeUpload({ sessionId, uploadedBy: req.userId, parts })
  return { status: HTTP.OK, message: 'Upload completed successfully', data }
})

const abortUpload = handleRoute('abortUpload', 'Failed to abort upload', async (req) => {
  const { sessionId } = req.params
  const data = await uploadService.abortUpload({ sessionId, uploadedBy: req.userId })
  return { status: HTTP.OK, message: 'Upload aborted', data }
})

const getUploadStatus = handleRoute('getUploadStatus', 'Failed to retrieve upload status', async (req) => {
  const { sessionId } = req.params
  const data = await uploadService.getSessionStatus({ sessionId, uploadedBy: req.userId })
  return { status: HTTP.OK, message: 'Upload status retrieved', data }
})

module.exports = {
  initiateUpload,
  getPartUrls,
  acknowledgePart,
  completeUpload,
  abortUpload,
  getUploadStatus,
}