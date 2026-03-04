// models/battery.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const batteryHistorySchema = new mongoose.Schema(
  {
    // Equipment Details
    equipment:   { type: String, required: true },
    equipmentNo: { type: String, required: true },
    batteryModel: { type: String, required: true },

    // Deployment
    location: { type: String, required: true },
    operator: { type: String, required: true },
    date:     { type: Date,   required: true },

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

module.exports = mongoose.model('BatteryHistory', batteryHistorySchema);