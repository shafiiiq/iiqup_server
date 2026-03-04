// models/maintenance-history.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const maintenanceHistorySchema = new mongoose.Schema(
  {
    // Equipment Details
    regNo:     { type: Number, required: true },
    equipment: { type: String, required: true },

    // Work Details
    date:        { type: String, required: true },
    mechanics:   { type: String, required: true },
    workRemarks: { type: String, required: true },

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

module.exports = mongoose.model('MaintenanceHistory', maintenanceHistorySchema);