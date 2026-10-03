const mongoose = require('mongoose');

const documentFolderSchema = new mongoose.Schema(
  {
    sourceType: { type: String, required: true, enum: ['equipment', 'operator', 'mechanic', 'staff'] },
    sourceId: { type: String, required: true },
    parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFolder', default: null },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

documentFolderSchema.index({ sourceType: 1, sourceId: 1, parentFolderId: 1 });

module.exports = mongoose.model('DocumentFolder', documentFolderSchema);