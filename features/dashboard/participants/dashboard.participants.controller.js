const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const participantsService = require('./dashboard.participants.service')

const getRecentParticipants = async (req, res) => {
  try {
    const { references } = req.body
    if (!Array.isArray(references)) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'references array is required' })
    }

    const result = await participantsService.fetchRecentParticipants(references)
    sendSuccess(res, result)
  } catch (error) {
    logger.error('[dashboard.participants.controller] getRecentParticipants', error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

module.exports = { getRecentParticipants }