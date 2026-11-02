const mongoose = require('mongoose')

const signatureChallengeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureDevice', required: true },
    nonce: { type: String, required: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
)

signatureChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('SignatureChallenge', signatureChallengeSchema)