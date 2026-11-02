const SignatureDevice = require('./signature.device.model')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { generateDeviceToken, sha256Hex } = require('./signature.crypto')
const { parseUserAgent } = require('./signature.useragent')
const { notifySignatureStatusChanged } = require('./signature.status.notification')
const {
  MAX_DEVICE_LABEL_LENGTH,
  MAX_SIGNATURE_DEVICES,
  DEVICE_PLATFORM,
  DEVICE_ROLE,
  SIGNATURE_ERROR_CODE,
} = require('./signature.constant')

const PRIMARY_DEVICE_FILTER = { role: { $ne: DEVICE_ROLE.FAMILY } }

const isPrimaryDevice = (device) => device.role !== DEVICE_ROLE.FAMILY

const resolveDeviceDetails = ({ userAgent, browser, operatingSystem }) => {
  const parsed = parseUserAgent(userAgent)
  return { browser: browser || parsed.browser, operatingSystem: operatingSystem || parsed.operatingSystem }
}

const createDevice = async ({
  userId,
  label,
  userAgent,
  platform,
  role = DEVICE_ROLE.PRIMARY,
  publicKey = '',
  ipAddress = '',
  timezone = '',
  browser,
  operatingSystem,
}) => {
  const deviceToken = generateDeviceToken()
  const details = resolveDeviceDetails({ userAgent, browser, operatingSystem })
  const device = await SignatureDevice.create({
    userId,
    tokenHash: sha256Hex(deviceToken),
    label: String(label || `${details.browser} on ${details.operatingSystem}`).slice(0, MAX_DEVICE_LABEL_LENGTH),
    platform,
    role,
    publicKey,
    browser: details.browser,
    operatingSystem: details.operatingSystem,
    ipAddress,
    timezone,
    userAgent: String(userAgent || '').slice(0, 500),
  })
  await notifySignatureStatusChanged(userId)
  return { deviceId: device._id.toString(), deviceToken }
}

const verifyDeviceToken = async ({ userId, deviceToken }) => {
  if (!deviceToken || typeof deviceToken !== 'string') return null
  return SignatureDevice.findOneAndUpdate(
    {
      tokenHash: sha256Hex(deviceToken),
      userId,
      isActive: true,
      platform: { $in: Object.values(DEVICE_PLATFORM) },
    },
    { $set: { lastUsedAt: new Date() } },
    { new: true }
  ).lean()
}

const countActiveDevices = (userId) => SignatureDevice.countDocuments({ userId, isActive: true })

const assertFamilyAccessAvailable = async (userId) => {
  const hasPrimaryDevice = await SignatureDevice.exists({ userId, isActive: true, ...PRIMARY_DEVICE_FILTER })
  if (!hasPrimaryDevice) {
    throw new AppError('Activate your main phone before adding family devices', HTTP.CONFLICT, {
      code: SIGNATURE_ERROR_CODE.NO_PRIMARY_DEVICE,
    })
  }
  if ((await countActiveDevices(userId)) >= MAX_SIGNATURE_DEVICES) {
    throw new AppError(`A maximum of ${MAX_SIGNATURE_DEVICES} devices can be used`, HTTP.CONFLICT, {
      code: SIGNATURE_ERROR_CODE.FAMILY_LIMIT_REACHED,
    })
  }
}

const listDevices = async (userId) =>
  SignatureDevice.find({ userId, isActive: true })
    .select('label platform role browser operatingSystem ipAddress timezone lastUsedAt createdAt')
    .sort({ lastUsedAt: -1 })
    .lean()

const revokeAllDevices = async (userId, preservedDeviceId = null) => {
  const filter = { userId, isActive: true }
  if (preservedDeviceId) filter._id = { $ne: preservedDeviceId }
  const result = await SignatureDevice.updateMany(filter, { $set: { isActive: false } })
  await notifySignatureStatusChanged(userId)
  return result
}

const revokeDevice = async ({ userId, deviceId }) => {
  const device = await SignatureDevice.findOneAndUpdate(
    { _id: deviceId, userId, isActive: true },
    { $set: { isActive: false } }
  )
  if (!device) throw new AppError('Device not found', HTTP.NOT_FOUND)
  if (isPrimaryDevice(device)) await revokeAllDevices(userId)
  await notifySignatureStatusChanged(userId)
  return { deviceId }
}

module.exports = {
  createDevice,
  verifyDeviceToken,
  isPrimaryDevice,
  countActiveDevices,
  assertFamilyAccessAvailable,
  listDevices,
  revokeDevice,
  revokeAllDevices,
}