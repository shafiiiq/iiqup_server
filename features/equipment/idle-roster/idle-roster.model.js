const mongoose = require('mongoose');

const rosterItemSchema = new mongoose.Schema(
  {
    equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipments', default: null },
    regNo: { type: String, required: true },
    machine: { type: String, default: '' },
    brand: { type: String, default: '' },
    year: { type: Number, default: null },
    status: { type: String, enum: ['idle', 'maintenance'], required: true },
    site: { type: String, default: '' },
    idleAt: { type: String, default: '' },
    idleSite: { type: String, default: '' },
    operatorName: { type: String, default: '' },
    remarks: { type: String, default: '' },
    mobDate: { type: Date, default: null },
    demobDate: { type: Date, default: null },
  },
  { _id: false }
);

const idleRosterSchema = new mongoose.Schema(
  {
    entries: { type: [rosterItemSchema], default: [] },
    isLatest: { type: Boolean, default: true },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

idleRosterSchema.index({ isLatest: 1 });
idleRosterSchema.index({ savedAt: -1 });

module.exports = mongoose.model('IdleRoster', idleRosterSchema);