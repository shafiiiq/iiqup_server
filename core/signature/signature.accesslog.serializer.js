const { parseUserAgent } = require('./signature.useragent')
const { SIGNATURE_ACCESS_TYPE } = require('./signature.constant')

const serializeSigning = (event, deviceById) => {
  const device = deviceById.get(String(event.deviceId))
  const { browser, operatingSystem } = parseUserAgent(event.userAgent)
  return {
    accessType: SIGNATURE_ACCESS_TYPE.WRITE,
    entryKey: `${SIGNATURE_ACCESS_TYPE.WRITE}:${event._id}`,
    occurredAt: event.signedAt,
    eventId: event._id.toString(),
    sourceKey: event.sourceKey,
    documentId: event.documentId,
    slotId: event.slotId,
    signedAt: event.signedAt,
    wasOverride: event.wasOverride,
    ipAddress: event.ipAddress,
    browser,
    operatingSystem,
    deviceLabel: device?.label || 'Removed device',
    devicePlatform: device?.platform || 'web',
  }
}

const serializeRead = (readLog, readerNameById) => {
  const { browser, operatingSystem } = parseUserAgent(readLog.userAgent)
  return {
    accessType: SIGNATURE_ACCESS_TYPE.READ,
    entryKey: `${SIGNATURE_ACCESS_TYPE.READ}:${readLog._id}`,
    occurredAt: readLog.readAt,
    readId: readLog._id.toString(),
    readerName: readerNameById.get(String(readLog.readerUserId)) || 'Unknown user',
    isOwnRead: String(readLog.readerUserId) === String(readLog.ownerUserId),
    sourceKey: readLog.sourceKey,
    documentId: readLog.documentId,
    slotId: readLog.slotId,
    readAt: readLog.readAt,
    ipAddress: readLog.ipAddress,
    browser,
    operatingSystem,
  }
}

const serializeActivation = (request) => ({
  accessType: SIGNATURE_ACCESS_TYPE.ACTIVATION,
  entryKey: `${SIGNATURE_ACCESS_TYPE.ACTIVATION}:${request._id}`,
  occurredAt: request.createdAt,
  requestId: request._id.toString(),
  status: request.status,
  createdAt: request.createdAt,
  resolvedAt: request.resolvedAt,
  device: {
    label: request.deviceLabel,
    browser: request.browser,
    operatingSystem: request.operatingSystem,
    ipAddress: request.ipAddress,
    timezone: request.timezone,
  },
})

module.exports = { serializeSigning, serializeRead, serializeActivation }