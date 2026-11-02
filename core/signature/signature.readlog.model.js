const mongoose = require('mongoose')

const signatureReadLogSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SignatureEvent', required: true },
    sourceKey: { type: String, required: true },
    documentId: { type: String, required: true },
    slotId: { type: String, required: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

signatureReadLogSchema.index({ ownerUserId: 1, readAt: -1 })
signatureReadLogSchema.index({ eventId: 1, readerUserId: 1, readAt: -1 })

module.exports = mongoose.model('SignatureReadLog', signatureReadLogSchema)