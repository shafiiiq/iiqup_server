const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    sourceType: { type: String, required: true, enum: ['equipment', 'operator', 'mechanic', 'staff'], index: true },
    sourceId: { type: String, required: true, index: true },
    displayName: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true },
    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true, default: 'application/octet-stream' },
    fileSize: { type: Number, default: 0 },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    renewalStatus: { type: String, enum: ['none', 'renewed', 'expired'], default: 'none' },
    renewedFromDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
    uploadSessionId: { type: String, unique: true, sparse: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFolder', default: null, index: true },
    uploadedBy: { type: String },
  },
  { timestamps: true }
);

documentSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);