const mongoose = require('mongoose')
const { ACTIVATION_REQUEST_STATUS, ACTIVATION_REQUEST_KIND, DEVICE_PLATFORM } = require('./signature.constant')

const signatureActivationRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ACTIVATION_REQUEST_STATUS),
      default: ACTIVATION_REQUEST_STATUS.PENDING,
    },
    matchNumber: { type: Number, required: true },
    numberChoices: { type: [Number], default: [] },
    pollSecretHash: { type: String, required: true },
    kind: { type: String, enum: Object.values(ACTIVATION_REQUEST_KIND), default: ACTIVATION_REQUEST_KIND.ACTIVATION },
    devicePlatform: { type: String, enum: Object.values(DEVICE_PLATFORM), default: DEVICE_PLATFORM.WEB },
    publicKey: { type: String, default: '' },
    deviceLabel: { type: String, default: '' },
    browser: { type: String, default: '' },
    operatingSystem: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    timezone: { type: String, default: '' },
    wrongAttempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true }
)

signatureActivationRequestSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('SignatureActivationRequest', signatureActivationRequestSchema)