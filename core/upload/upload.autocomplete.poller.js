const logger = require('#shared/logger/logger')
const { AUTOCOMPLETE_POLL_INTERVAL_MS } = require('./upload.config')
const { completeIdleUploadedSessions } = require('./upload.autocomplete.service')

let pollTimer = null
let isTickRunning = false

const runPollTick = async () => {
  if (isTickRunning) return
  isTickRunning = true
  try {
    await completeIdleUploadedSessions()
  } catch (error) {
    logger.error('[upload.autocomplete] tick failed:', error)
  } finally {
    isTickRunning = false
  }
}

const startUploadAutocompletePoller = () => {
  if (pollTimer) return
  pollTimer = setInterval(runPollTick, AUTOCOMPLETE_POLL_INTERVAL_MS)
  logger.info('[upload.autocomplete] started')
}

module.exports = {
  startUploadAutocompletePoller,
}