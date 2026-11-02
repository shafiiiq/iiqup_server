const mongoose = require('mongoose')
const { DELEGATION_STATUS } = require('./signature.constant')

const signatureDelegationSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    delegateUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(DELEGATION_STATUS), default: DELEGATION_STATUS.PENDING },
    requestedSourceKey: { type: String, default: '' },
    requestedDocumentId: { type: String, default: '' },
    requestedSlotId: { type: String, default: '' },
    requestedSlotLabel: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

signatureDelegationSchema.index({ delegateUserId: 1, status: 1 })

module.exports = mongoose.model('SignatureDelegation', signatureDelegationSchema)