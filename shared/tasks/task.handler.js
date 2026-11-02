const logger = require('#shared/logger/logger')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const { resolveSince } = require('./task.window')
const { resolveSigners } = require('./task.signer')

const createTaskHandler = (logTag, loadEntries) => async (req, res) => {
  try {
    const entries = await loadEntries(resolveSince(req.query.since))
    const data = await resolveSigners(entries)
    sendSuccess(res, { success: true, message: 'Tasks retrieved successfully', data })
  } catch (error) {
    logger.error(`[${logTag}] getTasks:`, error)
    sendError(res, { success: false, message: error.message })
  }
}

module.exports = { createTaskHandler }