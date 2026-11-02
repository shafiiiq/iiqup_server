const mongoose = require('mongoose')
const { DEVICE_PLATFORM, DEVICE_ROLE } = require('./signature.constant')

const signatureDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    label: { type: String, default: 'Unnamed device' },
    platform: { type: String, enum: Object.values(DEVICE_PLATFORM), required: true },
    role: { type: String, enum: Object.values(DEVICE_ROLE), default: DEVICE_ROLE.PRIMARY },
    publicKey: { type: String, default: '' },
    browser: { type: String, default: '' },
    operatingSystem: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    timezone: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SignatureDevice', signatureDeviceSchema)