const crypto = require('crypto')
const { Types } = require('mongoose')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const SignatureChallenge = require('./signature.challenge.model')
const { verifyDeviceToken } = require('./signature.device.service')
const { buildProofMessage, verifyProof } = require('./signature.proof')
const { CHALLENGE_VALID_SECONDS, DEVICE_PLATFORM, SIGNATURE_ERROR_CODE } = require('./signature.constant')

const NONCE_BYTES = 32

const buildProofFailure = () =>
  new AppError('Device proof is invalid', HTTP.FORBIDDEN, { code: SIGNATURE_ERROR_CODE.DEVICE_PROOF_INVALID })

const issueChallenge = async ({ userId, deviceToken }) => {
  const device = await verifyDeviceToken({ userId, deviceToken })
  if (!device) {
    throw new AppError('This device is not activated for signing', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.DEVICE_NOT_ACTIVATED,
    })
  }

  const challenge = await SignatureChallenge.create({
    userId,
    deviceId: device._id,
    nonce: crypto.randomBytes(NONCE_BYTES).toString('hex'),
    expiresAt: new Date(Date.now() + CHALLENGE_VALID_SECONDS * 1000),
  })

  return { challengeId: challenge._id.toString(), nonce: challenge.nonce }
}

const assertDeviceProof = async ({ device, challengeId, proof, sourceKey, documentId, slotId }) => {
  if (device.platform === DEVICE_PLATFORM.MOBILE) return
  if (!device.publicKey || !Types.ObjectId.isValid(challengeId) || typeof proof !== 'string') {
    throw buildProofFailure()
  }

  const challenge = await SignatureChallenge.findOneAndUpdate(
    { _id: challengeId, deviceId: device._id, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  ).lean()
  if (!challenge) throw buildProofFailure()

  const isProofValid = verifyProof({
    publicKey: device.publicKey,
    message: buildProofMessage({ nonce: challenge.nonce, sourceKey, documentId, slotId }),
    proof,
  })
  if (!isProofValid) throw buildProofFailure()
}

module.exports = { issueChallenge, assertDeviceProof }