const mongoose = require('mongoose')
const { SIGNUP_STATUS, ACCOUNT_TYPES } = require('./signup.constant')

const signupRequestSchema = new mongoose.Schema(
  {
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    qatarId: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    socialProvider: { type: String },
    socialSubject: { type: String },
    approvalCode: { type: String, required: true },
    status: { type: String, enum: Object.values(SIGNUP_STATUS), default: SIGNUP_STATUS.PENDING },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

signupRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
signupRequestSchema.index({ status: 1, approvalCode: 1 })

module.exports = mongoose.model('SignupRequest', signupRequestSchema)