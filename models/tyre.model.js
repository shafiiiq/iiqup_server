// models/tyre-history.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const tyreHistorySchema = new mongoose.Schema(
  {
    // Tyre Details
    tyreModel:  { type: String, required: true },
    tyreNumber: { type: String, required: true },

    // Equipment
    equipment:   { type: String, required: true },
    equipmentNo: { type: String, required: true },

    // Deployment
    date:         { type: Date,   required: true },
    location:     { type: String, required: true },
    operator:     { type: String, required: true },
    runningHours: { type: String, required: true },

    // Reference
    reportId: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('TyreHistory', tyreHistorySchema);