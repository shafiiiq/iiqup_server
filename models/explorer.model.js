const mongoose = require('mongoose');

const featureItemSchema = new mongoose.Schema({
  headline: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  highlights: [{
    type: String,
    required: true
  }],
  videoUrl: {
    type: String,
    required: true
  },
  videoFileName: {
    type: String,
    required: true
  },
  videoMimeType: {
    type: String,
    required: true
  },
  uploadStatus: {
    type: String,
    enum: ['uploading', 'active', 'failed'],
    default: 'uploading'
  },
  order: {
    type: Number,
    default: 1
  }
}, { _id: true });

const explorerSchema = new mongoose.Schema({
  releaseVersion: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  features: [featureItemSchema], 
  isActive: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
explorerSchema.index({ releaseVersion: 1 });
explorerSchema.index({ isActive: 1 });

const Explorer = mongoose.model('Explorer', explorerSchema);

module.exports = Explorer;