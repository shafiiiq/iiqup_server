const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    remarks: { type: String, default: '' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    assigneeCode: { type: String, default: null },
    assigneeName: { type: String, default: '' },
    createdByCode: { type: String, required: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ date: 1, createdByCode: 1, time: 1 });
scheduleSchema.index({ date: 1, assigneeCode: 1, time: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);