const mongoose = require('mongoose')

const signatureActivationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SignatureActivation', signatureActivationSchema)