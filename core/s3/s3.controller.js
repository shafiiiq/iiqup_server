const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const s3Service = require('./s3.service')

const retrivePresignedUrl = async (req, res) => {
  try {
    const { key, isLong, isAuthSign } = req.body
    if (!key) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'key is required' })

    const result = await s3Service.fetchPresignedURL(key, isLong, isAuthSign)

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message })
    }

    sendSuccess(res, { success: true, dataUrl: result.dataUrl })
  } catch (error) {
    logger.error('[S3] retrivePresignedUrl:', error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

module.exports = {
  retrivePresignedUrl,
}