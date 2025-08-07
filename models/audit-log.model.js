const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Allow null for bulk operations
    index: true
  },
  collectionName: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    required: true
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  documentSnapshot: mongoose.Schema.Types.Mixed,
  source: {
    type: String,
    default: 'database'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
auditLogSchema.index({ documentId: 1, collectionName: 1 });
auditLogSchema.index({ collectionName: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // For date range queries

module.exports = mongoose.model('AuditLog', auditLogSchema);