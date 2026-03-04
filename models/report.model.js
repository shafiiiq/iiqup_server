// models/service-report.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const checklistItemSchema = new mongoose.Schema(
  {
    id:          { type: Number, required: true },
    description: { type: String, required: true },
    status:      { type: String, enum: ['✓', '✗', '--', ''], default: '' },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const serviceReportSchema = new mongoose.Schema(
  {
    // Equipment Reference
    regNo:   { type: String, required: true },
    machine: { type: String, required: true },

    // Service Details
    date:           { type: String, required: true },
    serviceHrs:     { type: String, required: true },
    nextServiceHrs: { type: String, required: true },
    serviceType:    { type: String                 },
    location:       { type: String, required: true },

    // Personnel
    mechanics:    { type: String, required: true },
    operatorName: { type: String, required: true },

    // Content
    remarks:       { type: String,               default: ''  },
    checklistItems: { type: [checklistItemSchema], default: [] },

    // Reference
    historyId: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

serviceReportSchema.index({ regNo: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('ServiceReport', serviceReportSchema);