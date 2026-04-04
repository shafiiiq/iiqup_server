// models/report.model.js
const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(   
  {
    id:          { type: Number, required: true },
    description: { type: String, required: true },
    status:      { type: String, enum: ['✓', '✗', '--', ''], default: '' },
  },
  { _id: false }
);

const serviceReportSchema = new mongoose.Schema(
  {
    // ── Equipment Reference ───────────────────────────────────────────────────
    regNo:   { type: String, required: true },
    machine: { type: String, required: true },

    // ── Service Details ───────────────────────────────────────────────────────
    date:           { type: String, required: true },
    serviceType:    { type: String, required: true, enum: ['oil', 'normal', 'tyre', 'battery', 'major'] },
    serviceHrs:     { type: String, default: null },
    nextServiceHrs: { type: String, default: null },
    location:       { type: String, default: null },

    // ── Personnel ─────────────────────────────────────────────────────────────
    mechanics:    { type: String, default: null },
    operatorName: { type: String, default: null },

    // ── Content ───────────────────────────────────────────────────────────────
    remarks:        { type: String,                default: null },
    checklistItems: { type: [checklistItemSchema], default: []   },

    // ── Reference ─────────────────────────────────────────────────────────────
    historyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceHistory', default: null },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
serviceReportSchema.index({ regNo: 1 });
serviceReportSchema.index({ regNo: 1, date: 1 });
serviceReportSchema.index({ regNo: 1, serviceType: 1 });
serviceReportSchema.index({ date: 1 });

module.exports = mongoose.model('ServiceReport', serviceReportSchema);