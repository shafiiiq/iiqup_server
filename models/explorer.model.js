// models/explorer.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const featureItemSchema = new mongoose.Schema(
  {
    headline:      { type: String, required: true, trim: true },
    description:   { type: String, required: true, trim: true },
    videoUrl:      { type: String, required: true             },
    videoFileName: { type: String, required: true             },
    videoMimeType: { type: String, required: true             },
    highlights:    { type: [String], default: []              },
    uploadStatus:  { type: String, enum: ['uploading', 'active', 'failed'], default: 'uploading' },
    order:         { type: Number, default: 1                 },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const explorerSchema = new mongoose.Schema(
  {
    // Identity
    releaseVersion: { type: String, required: true, unique: true, trim: true },
    releaseDate:    { type: Date,   default: Date.now                         },
    isActive:       { type: Boolean, default: false                           },

    // Content
    features: { type: [featureItemSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

explorerSchema.index({ releaseVersion: 1 });
explorerSchema.index({ isActive:       1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Explorer', explorerSchema);