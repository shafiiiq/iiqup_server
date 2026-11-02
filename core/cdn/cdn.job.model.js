const mongoose = require('mongoose')

const videoJobSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, index: true },
    type: { type: String, enum: ['split', 'thumbnail', 'luminance', 'transcode', 'combine'], required: true },
    chunkIndex: { type: Number, default: -1 },
    renditionName: { type: String, default: '' },
    status: { type: String, enum: ['waiting', 'running', 'done', 'failed'], default: 'waiting' },
    priority: { type: Number, required: true },
    attempts: { type: Number, default: 0 },
    workerId: { type: String },
    startedAt: { type: Date },
    heartbeatAt: { type: Date },
    finishedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
)

videoJobSchema.index(
  { assetId: 1, type: 1, chunkIndex: 1, renditionName: 1 },
  { unique: true }
)
videoJobSchema.index({ status: 1, priority: -1, createdAt: 1 })
videoJobSchema.index({ status: 1, heartbeatAt: 1 })

const VideoJob = mongoose.model('VideoJob', videoJobSchema)

module.exports = VideoJob