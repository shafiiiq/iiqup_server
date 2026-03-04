// models/service-history.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const serviceHistorySchema = new mongoose.Schema(
  {
    // Equipment Reference
    regNo: { type: Number, required: true },

    // Service Details
    date:           { type: String,  required: true },
    serviceHrs:     { type: String,  required: true },
    nextServiceHrs: { type: String,  required: true },
    serviceType:    { type: String                  },
    fullService:    { type: Boolean                 },

    // Filters & Fluids
    oil:            { type: String, required: true },
    oilFilter:      { type: String, required: true },
    fuelFilter:     { type: String, required: true },
    acFilter:       { type: String, required: true },
    waterSeparator: { type: String, required: true },
    airFilter:      { type: String, required: true },

    // Reference
    reportId:      { type: String, default: null },
    serviceReport: { type: [],     default: []   },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('ServiceHistory', serviceHistorySchema);