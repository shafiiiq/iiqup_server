const mongoose = require('mongoose')

const signatureAssetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, required: true },
    s3Key: { type: String, required: true },
    imageSha256: { type: String, required: true },
    encryptedMetadata: { type: String, required: true },
    isCurrent: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

signatureAssetSchema.index({ userId: 1, version: 1 }, { unique: true })
signatureAssetSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true }, name: 'one_current_signature_per_user' }
)

module.exports = mongoose.model('SignatureAsset', signatureAssetSchema)