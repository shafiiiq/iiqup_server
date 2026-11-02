const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')

const handleLinkRoute = (logTag, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req))
  } catch (error) {
    logger.error(`[oauth.controller] ${logTag}`, error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

module.exports = { handleLinkRoute }