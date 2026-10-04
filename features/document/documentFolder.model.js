const mongoose = require('mongoose');

const documentFolderSchema = new mongoose.Schema(
  {
    sourceType: { type: String, required: true, enum: ['equipment', 'operator', 'mechanic', 'staff', 'root'] },
    area: { type: String, enum: ['all', 'renewed', 'expired', 'source'], default: 'all' },
    sourceId: { type: String, required: true },
    parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFolder', default: null },
    name: { type: String, required: true, trim: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    trashBatchId: { type: String, default: null },
    isTrashRoot: { type: Boolean, default: false },
    trashedFromPath: { type: String, default: null },
    trashedFromFolderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

documentFolderSchema.index({ sourceType: 1, sourceId: 1, parentFolderId: 1, deletedAt: 1 });
documentFolderSchema.index({ isTrashRoot: 1, deletedAt: 1 });
documentFolderSchema.index({ trashBatchId: 1 });

module.exports = mongoose.model('DocumentFolder', documentFolderSchema);