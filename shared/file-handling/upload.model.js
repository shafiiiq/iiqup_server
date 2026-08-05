const mongoose = require('mongoose');

const partSchema = new mongoose.Schema(
  {
    partNumber: { type: Number, required: true },
    etag: { type: String, required: true },
    size: { type: Number },
  },
  { _id: false }
);

// Generic upload session — deliberately feature-agnostic.
// `feature` + `context` describe who owns it; `entityId` is attached once
// the owning record exists (e.g. complaintId), and may be null at creation.
const uploadSessionSchema = new mongoose.Schema({
  feature: { type: String, required: true, index: true },
  context: { type: String },
  entityId: { type: String, index: true },

  uploadedBy: { type: String, required: true, index: true },

  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },

  s3Key: { type: String, required: true },
  s3UploadId: { type: String, required: true },
  partSize: { type: Number, required: true },
  totalParts: { type: Number, required: true },

  parts: [partSchema],

  status: {
    type: String,
    enum: ['initiated', 'uploading', 'completed', 'aborted', 'failed'],
    default: 'initiated',
  },

  error: { type: String },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

uploadSessionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const UploadSession = mongoose.model('UploadSession', uploadSessionSchema);
module.exports = UploadSession;