const SignatureReadLog = require('./signature.readlog.model')
const { READ_LOG_DEDUPE_MINUTES } = require('./signature.constant')

const MILLISECONDS_PER_MINUTE = 60 * 1000

const recordSignatureRead = async ({ event, readerUserId, ipAddress, userAgent }) => {
  const windowStart = new Date(Date.now() - READ_LOG_DEDUPE_MINUTES * MILLISECONDS_PER_MINUTE)
  const hasRecentRead = await SignatureReadLog.exists({
    eventId: event._id,
    readerUserId,
    readAt: { $gte: windowStart },
  })
  if (hasRecentRead) return

  await SignatureReadLog.create({
    ownerUserId: event.userId,
    readerUserId,
    eventId: event._id,
    sourceKey: event.sourceKey,
    documentId: event.documentId,
    slotId: event.slotId,
    ipAddress: String(ipAddress || ''),
    userAgent: String(userAgent || '').slice(0, 500),
  })
}

module.exports = { recordSignatureRead }