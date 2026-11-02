const mongoose = require('mongoose')
const { SUPPORTED_PROVIDERS } = require('./oauth.constant')

const socialLinkSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: SUPPORTED_PROVIDERS, required: true },
    subject: { type: String, required: true },
    accountType: { type: String, enum: ['staff', 'mechanic', 'operator'], required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
    email: { type: String, default: '' },
  },
  { timestamps: true }
)

socialLinkSchema.index({ provider: 1, subject: 1 }, { unique: true })
socialLinkSchema.index({ accountType: 1, accountId: 1, provider: 1 }, { unique: true })

module.exports = mongoose.model('SocialLink', socialLinkSchema)