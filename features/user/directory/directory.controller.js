const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const directoryService = require('./directory.service')

const getDirectoryUsers = async (req, res) => {
  try {
    const result = await directoryService.fetchDirectoryUsers(req.query.search, req.pagination.limit)
    sendSuccess(res, result)
  } catch (error) {
    logger.error('[directory.controller] getDirectoryUsers', error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

module.exports = { getDirectoryUsers }