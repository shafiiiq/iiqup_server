const mongoose = require('mongoose')

const signatureEventSchema = new mongoose.Schema(
  {
    sourceKey: { type: String, required: true },
    documentId: { type: String, required: true },
    documentRevision: { type: Number, required: true },
    slotId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureAsset', required: true },
    imageSha256: { type: String, required: true },
    documentHash: { type: String, required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureDevice', required: true },
    wasOverride: { type: Boolean, default: false },
    delegatedFromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    delegationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureDelegation', default: null },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    signedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

signatureEventSchema.index(
  { sourceKey: 1, documentId: 1, documentRevision: 1, slotId: 1 },
  { unique: true }
)

module.exports = mongoose.model('SignatureEvent', signatureEventSchema)