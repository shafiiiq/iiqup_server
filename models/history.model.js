// models/history.model.js
const mongoose = require('mongoose');

const serviceHistorySchema = new mongoose.Schema(
  {
    // ── Core (all types) ──────────────────────────────────────────────────────
    regNo:       { type: String, required: true },
    serviceType: { type: String, required: true, enum: ['oil', 'normal', 'tyre', 'battery', 'major'] },
    date:        { type: String, required: true },
    equipment:   { type: String, default: null  },
    location:    { type: String, default: null  },
    operator:    { type: String, default: null  },
    mechanics:   { type: String, default: null  },
    remarks:     { type: String, default: null  },

    // ── Oil / Normal ──────────────────────────────────────────────────────────
    serviceHrs:     { type: String,  default: null },
    nextServiceHrs: { type: String,  default: null },
    fullService:    { type: Boolean, default: false },
    oil:            { type: String,  default: null },
    oilFilter:      { type: String,  default: null },
    fuelFilter:     { type: String,  default: null },
    acFilter:       { type: String,  default: null },
    waterSeparator: { type: String,  default: null },
    airFilter:      { type: String,  default: null },

    // ── Tyre ──────────────────────────────────────────────────────────────────
    tyreModel:    { type: String, default: null },
    tyreNumber:   { type: String, default: null },
    runningHours: { type: String, default: null },

    // ── Battery ───────────────────────────────────────────────────────────────
    batteryModel: { type: String, default: null },

    // ── Reference ─────────────────────────────────────────────────────────────
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceReport', default: null },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
serviceHistorySchema.index({ regNo: 1, serviceType: 1 });
serviceHistorySchema.index({ regNo: 1, serviceType: 1, date: 1 }, { unique: true });
serviceHistorySchema.index({ date: 1 });

module.exports = mongoose.model('ServiceHistory', serviceHistorySchema);