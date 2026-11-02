const SignatureAsset = require('./signature.asset.model')
const SignatureActivation = require('./signature.activation.model')
const { loadSignatureImage } = require('./signature.storage')

const buildImageDataUrl = async (s3Key) => `data:image/png;base64,${(await loadSignatureImage(s3Key)).toString('base64')}`

const getOwnOverview = async (userId) => {
  const [asset, activation] = await Promise.all([
    SignatureAsset.findOne({ userId, isCurrent: true }).select('version s3Key createdAt').lean(),
    SignatureActivation.findOne({ userId }).select('usedAt expiresAt').lean(),
  ])
  const hasPendingCode = Boolean(activation && !activation.usedAt && activation.expiresAt > new Date())

  return {
    hasSignature: Boolean(asset),
    version: asset?.version ?? null,
    updatedAt: asset?.createdAt ?? null,
    imageDataUrl: asset ? await buildImageDataUrl(asset.s3Key) : null,
    activationExpiresAt: hasPendingCode ? activation.expiresAt : null,
  }
}

module.exports = { getOwnOverview }