const { Types } = require('mongoose')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const SignatureAsset = require('./signature.asset.model')
const { sha256Hex, encryptJson } = require('./signature.crypto')
const { buildSignatureKey, storeSignatureImage, signatureImageExists } = require('./signature.storage')
const { issueActivationCode } = require('./signature.activation.service')
const { revokeAllDevices } = require('./signature.device.service')
const { expirePendingRequests } = require('./signature.request.service')
const { MAX_SIGNATURE_IMAGE_BYTES, PNG_SIGNATURE_BYTES } = require('./signature.constant')

const isPngBuffer = (buffer) =>
  buffer.length > PNG_SIGNATURE_BYTES.length && buffer.subarray(0, PNG_SIGNATURE_BYTES.length).equals(PNG_SIGNATURE_BYTES)

const assertValidTargetUser = async (targetUserId) => {
  if (!Types.ObjectId.isValid(targetUserId)) throw new AppError('Invalid user id', HTTP.BAD_REQUEST)
  const user = await User.findById(targetUserId).select('isActive').lean()
  if (!user || !user.isActive) throw new AppError('Active user not found', HTTP.NOT_FOUND)
}

const assertValidImage = ({ imageBuffer, mimeType }) => {
  if (mimeType !== 'image/png' || !isPngBuffer(imageBuffer)) {
    throw new AppError('Signature must be a PNG image', HTTP.BAD_REQUEST)
  }
  if (imageBuffer.length > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new AppError('Signature image is too large', HTTP.BAD_REQUEST)
  }
}

const createSignatureForUser = async ({
  targetUserId,
  imageBuffer,
  originalName,
  mimeType,
  actorUserId,
  preservedDeviceId = null,
}) => {
  await assertValidTargetUser(targetUserId)
  assertValidImage({ imageBuffer, mimeType })

  const latestAsset = await SignatureAsset.findOne({ userId: targetUserId }).sort({ version: -1 }).select('version').lean()
  const version = (latestAsset?.version || 0) + 1
  const s3Key = buildSignatureKey(targetUserId, version)

  await storeSignatureImage(s3Key, imageBuffer)
  await SignatureAsset.updateMany({ userId: targetUserId, isCurrent: true }, { $set: { isCurrent: false } })

  const asset = await SignatureAsset.create({
    userId: targetUserId,
    version,
    s3Key,
    imageSha256: sha256Hex(imageBuffer),
    encryptedMetadata: encryptJson({
      originalName,
      mimeType,
      sizeBytes: imageBuffer.length,
      uploadedBy: String(actorUserId),
      uploadedAt: new Date().toISOString(),
    }),
    isCurrent: true,
    createdBy: actorUserId,
  })

  await revokeAllDevices(targetUserId, preservedDeviceId)
  await expirePendingRequests(targetUserId)
  const { activationCode, expiresAt } = await issueActivationCode({ userId: targetUserId, issuedBy: actorUserId })

  return { assetId: asset._id.toString(), version, activationCode, activationExpiresAt: expiresAt }
}

const reissueActivationCode = async ({ targetUserId, actorUserId }) => {
  await assertValidTargetUser(targetUserId)

  const asset = await SignatureAsset.findOne({ userId: targetUserId, isCurrent: true }).lean()
  if (!asset || !(await signatureImageExists(asset.s3Key))) {
    throw new AppError('No signature image is stored for this user', HTTP.NOT_FOUND)
  }

  await expirePendingRequests(targetUserId)
  const { activationCode, expiresAt } = await issueActivationCode({ userId: targetUserId, issuedBy: actorUserId })
  return { activationCode, activationExpiresAt: expiresAt }
}

module.exports = { createSignatureForUser, reissueActivationCode }