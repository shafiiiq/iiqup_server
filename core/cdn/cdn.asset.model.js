const mongoose = require('mongoose')

const renditionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    height: { type: Number, required: true },
    status: { type: String, enum: ['waiting', 'combining', 'ready'], default: 'waiting' },
    videoKey: { type: String },
    indexKey: { type: String },
    sizeBytes: { type: Number, default: 0 },
    transcodeDurationMs: { type: Number, default: 0 },
    combineDurationMs: { type: Number, default: 0 },
  },
  { _id: false }
)

const videoAssetSchema = new mongoose.Schema(
  {
    sourceSessionId: { type: String, required: true, unique: true },
    sourceKey: { type: String, required: true, index: true },
    sourceMimeType: { type: String, required: true },
    sourceFileName: { type: String, required: true },
    feature: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    status: {
      type: String,
      enum: ['waiting', 'splitting', 'processing', 'ready', 'failed'],
      default: 'waiting',
      index: true,
    },
    durationSeconds: { type: Number },
    width: { type: Number },
    height: { type: Number },
    hasAudio: { type: Boolean, default: true },
    chunkCount: { type: Number, default: 0 },
    sourceSizeBytes: { type: Number, default: 0 },
    totalRenditionBytes: { type: Number, default: 0 },
    uploadDurationMs: { type: Number, default: 0 },
    splitDurationMs: { type: Number, default: 0 },
    processingDurationMs: { type: Number, default: 0 },
    renditions: [renditionSchema],
    masterKey: { type: String },
    thumbnailKey: { type: String },
    thumbnailData: { type: Buffer, select: false },
    thumbnailContentType: { type: String },
    luminanceSamples: { type: [Number], default: [] },
    luminanceSampleSeconds: { type: Number },
    error: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
)

const VideoAsset = mongoose.model('VideoAsset', videoAssetSchema)

module.exports = VideoAsset