const SignatureEvent = require('./signature.event.model')
const SignatureDevice = require('./signature.device.model')
const SignatureActivationRequest = require('./signature.request.model')
const SignatureReadLog = require('./signature.readlog.model')
const User = require('#features/user/staff/staff.model')
const { serializeSigning, serializeRead, serializeActivation } = require('./signature.accesslog.serializer')
const { ACCESS_LOG_PAGE_SIZE, ACTIVATION_REQUEST_STATUS } = require('./signature.constant')

const parseBeforeDate = (before) => (before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null)

const buildFilter = (baseFilter, timeField, beforeDate) =>
  beforeDate ? { ...baseFilter, [timeField]: { $lt: beforeDate } } : baseFilter

const fetchSigningEntries = async ({ userId, beforeDate }) => {
  const events = await SignatureEvent.find(buildFilter({ userId }, 'signedAt', beforeDate))
    .sort({ signedAt: -1 })
    .limit(ACCESS_LOG_PAGE_SIZE)
    .lean()
  const deviceIds = [...new Set(events.map((event) => String(event.deviceId)))]
  const devices = await SignatureDevice.find({ _id: { $in: deviceIds } }).select('label platform').lean()
  const deviceById = new Map(devices.map((device) => [String(device._id), device]))
  return events.map((event) => serializeSigning(event, deviceById))
}

const fetchReadEntries = async ({ userId, beforeDate }) => {
  const reads = await SignatureReadLog.find(buildFilter({ ownerUserId: userId }, 'readAt', beforeDate))
    .sort({ readAt: -1 })
    .limit(ACCESS_LOG_PAGE_SIZE)
    .lean()
  const readers = await User.find({ _id: { $in: reads.map((readLog) => readLog.readerUserId) } })
    .select('name')
    .lean()
  const readerNameById = new Map(readers.map((reader) => [String(reader._id), reader.name]))
  return reads.map((readLog) => serializeRead(readLog, readerNameById))
}

const fetchActivationEntries = async ({ userId, beforeDate }) => {
  const requests = await SignatureActivationRequest.find(
    buildFilter({ userId, status: { $ne: ACTIVATION_REQUEST_STATUS.PENDING } }, 'createdAt', beforeDate)
  )
    .sort({ createdAt: -1 })
    .limit(ACCESS_LOG_PAGE_SIZE)
    .lean()
  return requests.map(serializeActivation)
}

const countAllEntries = async (userId) => {
  const counts = await Promise.all([
    SignatureEvent.countDocuments({ userId }),
    SignatureReadLog.countDocuments({ ownerUserId: userId }),
    SignatureActivationRequest.countDocuments({ userId, status: { $ne: ACTIVATION_REQUEST_STATUS.PENDING } }),
  ])
  return counts.reduce((sum, count) => sum + count, 0)
}

const getAccessLog = async ({ userId, before }) => {
  const beforeDate = parseBeforeDate(before)
  const [signingEntries, readEntries, activationEntries, totalCount] = await Promise.all([
    fetchSigningEntries({ userId, beforeDate }),
    fetchReadEntries({ userId, beforeDate }),
    fetchActivationEntries({ userId, beforeDate }),
    countAllEntries(userId),
  ])

  const mergedEntries = [...signingEntries, ...readEntries, ...activationEntries].sort(
    (first, second) => new Date(second.occurredAt) - new Date(first.occurredAt)
  )
  const pageEntries = mergedEntries.slice(0, ACCESS_LOG_PAGE_SIZE)
  const hasMore =
    mergedEntries.length > ACCESS_LOG_PAGE_SIZE ||
    [signingEntries, readEntries, activationEntries].some((entries) => entries.length === ACCESS_LOG_PAGE_SIZE)
  const lastEntry = pageEntries[pageEntries.length - 1]

  return {
    entries: pageEntries,
    hasMore,
    nextCursor: hasMore && lastEntry ? new Date(lastEntry.occurredAt).toISOString() : null,
    totalCount,
  }
}

module.exports = { getAccessLog }