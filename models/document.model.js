// models/document.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const documentFileSchema = new mongoose.Schema(
  {
    date:            { type: String },
    expiry:          { type: String },
    filename:        { type: String },
    displayFileName: { type: String },
    path:            { type: String, required: true },
    mimetype:        { type: String, required: true, default: 'application/octet-stream' },
  },
  {
    timestamps: true,
    _id:        false,
  },
);

const documentSourceSchema = new mongoose.Schema(
  {
    source:      { type: String, enum: ['office-staff', 'mechanic', 'operator', 'equipment'] },
    sourceId:    { type: String },
    sourceModel: { type: String, enum: ['Office Model', 'Mechanic Model', 'Opertor Model', 'Equipment Model'] },
  },
  {
    timestamps: true,
    _id:        false,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const documentSchema = new mongoose.Schema(
  {
    // Identity
    SourceId:     { type: String, required: true, trim: true },
    documentType: { type: String, required: true, trim: true },
    category:     { type: String, required: true, trim: true },
    regNo:        { type: String, trim: true                 },
    description:  { type: String, trim: true                 },

    // Files & Sources
    files:          { type: [documentFileSchema],  default: [] },
    documentSource: { type: [documentSourceSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

documentSchema.index({ regNo: 1, documentType: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Document', documentSchema);