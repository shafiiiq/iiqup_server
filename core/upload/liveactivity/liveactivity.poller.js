const logger = require('#shared/logger/logger')
const UploadSession = require('#core/upload/upload.model')
const { IS_APNS_CONFIGURED, POLL_INTERVAL_MS, MINIMUM_PROGRESS_STEP } = require('./liveactivity.config')
const { SESSION_STALE_HOURS } = require('#core/upload/upload.config')

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const { calculateBatchProgress, resolveUploadedBytes } = require('./liveactivity.progress')
const { pushSessionState } = require('./liveactivity.service')

let pollTimer = null
let isTickRunning = false

const markLiveActivityEnded = (session) =>
  UploadSession.updateOne({ _id: session._id }, { $set: { 'liveActivity.isEnded': true } })

const findRegisteredSessions = () =>
  UploadSession.find({
    status: { $in: ['initiated', 'uploading'] },
    createdAt: { $gt: new Date(Date.now() - SESSION_STALE_HOURS * MILLISECONDS_PER_HOUR) },
    'liveActivity.pushToken': { $type: 'string' },
    'liveActivity.isEnded': { $ne: true },
  })

const pushSessionIfProgressed = async (session) => {
  const uploadedBytes = await resolveUploadedBytes(session)
  const progress = calculateBatchProgress(session.liveActivity, uploadedBytes)
  const lastProgress = session.liveActivity.lastProgress || 0
  if (progress - lastProgress < MINIMUM_PROGRESS_STEP) return
  await pushSessionState(session, { event: 'update', progress })
}

const runPollTick = async () => {
  if (isTickRunning) return
  isTickRunning = true
  try {
    const sessions = await findRegisteredSessions()
    for (const session of sessions) {
      try {
        await pushSessionIfProgressed(session)
      } catch (error) {
        if (error.name === 'NoSuchUpload') await markLiveActivityEnded(session)
        logger.error('[liveactivity.poller] session push failed', {
          sessionId: String(session._id),
          error: error.message,
        })
      }
    }
  } catch (error) {
    logger.error('[liveactivity.poller] tick failed:', error)
  } finally {
    isTickRunning = false
  }
}

const startLiveActivityPoller = () => {
  if (pollTimer) return
  if (!IS_APNS_CONFIGURED) {
    logger.warn('[liveactivity.poller] APNS_KEY_ID, APNS_TEAM_ID or APNS_PRIVATE_KEY missing, poller not started')
    return
  }
  pollTimer = setInterval(runPollTick, POLL_INTERVAL_MS)
  logger.info('[liveactivity.poller] started')
}

module.exports = {
  startLiveActivityPoller,
}