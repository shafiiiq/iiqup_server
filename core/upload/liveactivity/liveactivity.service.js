const logger = require('#shared/logger/logger')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const UploadSession = require('#core/upload/upload.model')
const { buildLiveActivityPayload } = require('./liveactivity.payload')
const { sendLiveActivityPush, isPushTokenRejected } = require('./liveactivity.apns.client')
const { calculateBatchProgress } = require('./liveactivity.progress')

const toNonNegativeNumber = (value) => {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0
}

const assertSessionOwner = async (sessionId, uploadedBy) => {
  const session = await UploadSession.findById(sessionId).select('uploadedBy')
  if (!session) throw new AppError('Upload session not found', HTTP.NOT_FOUND)
  if (session.uploadedBy !== uploadedBy) {
    throw new AppError('Not authorized for this upload session', HTTP.FORBIDDEN)
  }
}

const saveSessionLiveActivity = async ({
  sessionId,
  uploadedBy,
  pushToken,
  displayName,
  itemNumber,
  itemCount,
  bytesBeforeItem,
  batchTotalBytes,
}) => {
  if (!pushToken || typeof pushToken !== 'string') throw new AppError('pushToken is required', HTTP.BAD_REQUEST)
  await assertSessionOwner(sessionId, uploadedBy)

  await UploadSession.updateOne(
    { _id: sessionId },
    {
      $set: {
        liveActivity: {
          pushToken,
          displayName: String(displayName || 'Uploading'),
          itemNumber: toNonNegativeNumber(itemNumber) || 1,
          itemCount: toNonNegativeNumber(itemCount) || 1,
          bytesBeforeItem: toNonNegativeNumber(bytesBeforeItem),
          batchTotalBytes: toNonNegativeNumber(batchTotalBytes),
          lastProgress: 0,
          isEnded: false,
        },
      },
    }
  )

  return { sessionId }
}

const clearSessionLiveActivity = async ({ sessionId, uploadedBy }) => {
  await assertSessionOwner(sessionId, uploadedBy)
  await UploadSession.updateOne({ _id: sessionId }, { $unset: { 'liveActivity.pushToken': '' } })
  return { sessionId }
}

const pushSessionState = async (session, { event, progress }) => {
  const { liveActivity } = session
  const payload = buildLiveActivityPayload({ liveActivity, progress, event })
  const result = await sendLiveActivityPush({ pushToken: liveActivity.pushToken, payload })
  const isRejected = isPushTokenRejected(result)
  const isDelivered = result.statusCode === 200

  if (!isDelivered) {
    logger.warn('[liveactivity.service] push not delivered', {
      sessionId: String(session._id),
      statusCode: result.statusCode,
      reason: result.reason,
    })
  }

  const updatedFields = { 'liveActivity.isEnded': event === 'end' || isRejected }
  if (isDelivered) updatedFields['liveActivity.lastProgress'] = progress
  await UploadSession.updateOne({ _id: session._id }, { $set: updatedFields })
}

const handleSessionCompleted = async (session) => {
  const { liveActivity } = session
  if (!liveActivity || !liveActivity.pushToken || liveActivity.isEnded) return

  const isLastItem = liveActivity.itemNumber >= liveActivity.itemCount
  const progress = isLastItem ? 1 : calculateBatchProgress(liveActivity, session.fileSize)
  await pushSessionState(session, { event: isLastItem ? 'end' : 'update', progress })
}

module.exports = {
  saveSessionLiveActivity,
  clearSessionLiveActivity,
  pushSessionState,
  handleSessionCompleted,
}