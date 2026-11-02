const bcrypt = require('bcrypt')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const SignatureActivation = require('./signature.activation.model')
const SignatureAsset = require('./signature.asset.model')
const { generateActivationCode } = require('./signature.crypto')
const { signatureImageExists } = require('./signature.storage')
const { createDevice, revokeAllDevices } = require('./signature.device.service')
const { notifySignatureStatusChanged } = require('./signature.status.notification')
const {
  ACTIVATION_CODE_VALID_DAYS,
  MAX_FAILED_ACTIVATION_ATTEMPTS,
  ACTIVATION_LOCK_MINUTES,
  DEVICE_PLATFORM,
} = require('./signature.constant')

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const MILLISECONDS_PER_MINUTE = 60 * 1000
const BCRYPT_ROUNDS = 10

const issueActivationCode = async ({ userId, issuedBy }) => {
  const activationCode = generateActivationCode()
  const codeHash = await bcrypt.hash(activationCode, BCRYPT_ROUNDS)
  const expiresAt = new Date(Date.now() + ACTIVATION_CODE_VALID_DAYS * MILLISECONDS_PER_DAY)

  await SignatureActivation.findOneAndUpdate(
    { userId },
    { $set: { codeHash, expiresAt, usedAt: null, failedAttempts: 0, lockedUntil: null, issuedBy } },
    { upsert: true, new: true }
  )
  await notifySignatureStatusChanged(userId)

  return { activationCode, expiresAt }
}

const registerFailedAttempt = async (recordId) => {
  const updated = await SignatureActivation.findByIdAndUpdate(recordId, { $inc: { failedAttempts: 1 } }, { new: true })
  if (updated.failedAttempts >= MAX_FAILED_ACTIVATION_ATTEMPTS) {
    await SignatureActivation.updateOne(
      { _id: recordId },
      {
        $set: {
          failedAttempts: 0,
          lockedUntil: new Date(Date.now() + ACTIVATION_LOCK_MINUTES * MILLISECONDS_PER_MINUTE),
        },
      }
    )
  }
}

const verifyActivationCode = async ({ userId, activationCode }) => {
  const record = await SignatureActivation.findOne({ userId })
  if (!record || record.usedAt) {
    throw new AppError('No pending signature activation for this account', HTTP.FORBIDDEN)
  }
  if (record.lockedUntil && record.lockedUntil > new Date()) {
    throw new AppError('Too many failed attempts. Try again later', HTTP.TOO_MANY_REQUESTS)
  }
  if (record.expiresAt < new Date()) {
    throw new AppError('Activation code has expired. Rotate a new one from the mobile app', HTTP.FORBIDDEN)
  }

  const asset = await SignatureAsset.findOne({ userId, isCurrent: true }).lean()
  if (!asset || !(await signatureImageExists(asset.s3Key))) {
    throw new AppError('No signature image is stored for this account', HTTP.NOT_FOUND)
  }

  const isCodeValid = await bcrypt.compare(String(activationCode || ''), record.codeHash)
  if (!isCodeValid) {
    await registerFailedAttempt(record._id)
    throw new AppError('Invalid activation code', HTTP.UNAUTHORIZED)
  }

  return record
}

const consumeActivationCode = async (userId) => {
  const consumed = await SignatureActivation.findOneAndUpdate(
    { userId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date(), failedAttempts: 0 } }
  )
  if (!consumed) throw new AppError('Activation code is no longer valid', HTTP.CONFLICT)
  await notifySignatureStatusChanged(userId)
}

const activateMobileDevice = async ({ userId, activationCode, deviceLabel, userAgent, operatingSystem, ipAddress }) => {
  await verifyActivationCode({ userId, activationCode })
  await consumeActivationCode(userId)
  const device = await createDevice({
    userId,
    label: deviceLabel,
    userAgent,
    platform: DEVICE_PLATFORM.MOBILE,
    browser: 'Al Ansari Connect app',
    operatingSystem,
    ipAddress,
  })
  await revokeAllDevices(userId, device.deviceId)
  return device
}

module.exports = { issueActivationCode, verifyActivationCode, consumeActivationCode, activateMobileDevice }