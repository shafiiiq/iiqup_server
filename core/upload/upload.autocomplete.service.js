const logger = require('#shared/logger/logger')
const { listUploadedParts } = require('#core/s3/s3.config')
const UploadSession = require('./upload.model')
const uploadService = require('./upload.service')
const { SESSION_STALE_HOURS, AUTOCOMPLETE_IDLE_MS } = require('./upload.config')

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

const stripEtagQuotes = (etag) => String(etag || '').replace(/"/g, '')

const findIdleUnfinishedSessions = () =>
  UploadSession.find({
    status: { $in: ['initiated', 'uploading'] },
    createdAt: { $gt: new Date(Date.now() - SESSION_STALE_HOURS * MILLISECONDS_PER_HOUR) },
    updatedAt: { $lt: new Date(Date.now() - AUTOCOMPLETE_IDLE_MS) },
  })

const completeSessionIfAllPartsUploaded = async (session) => {
  const listedParts = await listUploadedParts(session.s3Key, session.s3UploadId)
  if (listedParts.length !== session.totalParts) return

  await uploadService.completeUpload({
    sessionId: String(session._id),
    uploadedBy: session.uploadedBy,
    parts: listedParts.map((part) => ({
      partNumber: part.partNumber,
      etag: stripEtagQuotes(part.etag),
      size: part.size,
    })),
  })
}

const markSessionFailedAsMissingUpload = (session) =>
  UploadSession.updateOne(
    { _id: session._id },
    { $set: { status: 'failed', error: 'S3 multipart upload no longer exists' } }
  )

const completeIdleUploadedSessions = async () => {
  const sessions = await findIdleUnfinishedSessions()
  for (const session of sessions) {
    try {
      await completeSessionIfAllPartsUploaded(session)
    } catch (error) {
      if (error.name === 'NoSuchUpload') {
        await markSessionFailedAsMissingUpload(session)
        continue
      }
      logger.error('[upload.autocomplete] session failed', {
        sessionId: String(session._id),
        error: error.message,
      })
    }
  }
}

module.exports = {
  completeIdleUploadedSessions,
}