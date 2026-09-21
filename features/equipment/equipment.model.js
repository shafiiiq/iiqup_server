const mongoose = require('mongoose');

const certificationBodySchema = new mongoose.Schema(
  {
    operatorName: { type: String, default: 'Not Assigned' },
    operatorId: { type: String, default: 'Not Assigned' },
    assignedAt: { type: Date, default: Date.now },
    shiftName: { type: String, default: '' },
    shiftStart: { type: String, default: '' },
    shiftEnd: { type: String, default: '' },
  },
  { _id: false }
);

const rentRateSchema = new mongoose.Schema(
  {
    basis: {
      type: String,
      enum: ['daily', 'hourly', 'weekly', 'monthly', 'trip'],
      default: 'daily',
    },
    rate: { type: Number, default: 0 },
    currency: { type: String, default: 'QAR' },
  },
  { _id: false }
);

const maintenanceRecordSchema = new mongoose.Schema(
  {
    oil: { type: Number, default: 0 },
    normal: { type: Number, default: 0 },
    major: { type: Number, default: 0 },
    battery: { type: Number, default: 0 },
    tyre: { type: Number, default: 0 },
  },
  { _id: false }
);

const mobilizationsRecordSchema = new mongoose.Schema(
  {
    mobilization: { type: Number, default: 0 },
    demobilization: { type: Number, default: 0 },
  },
  { _id: false }
);

const replacementRecordSchema = new mongoose.Schema(
  {
    equipmentReplacement: { type: Number, default: 0 },
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    machine: { type: String, required: true },
    machineOriginal: { type: String, default: null },
    category: { type: String, default: null },
    subCategory: { type: String, default: null },
    regNo: { type: String, required: true },
    brand: { type: String, required: true },
    year: { type: Number, required: true },
    company: { type: String, required: true, default: 'ATE' },

    coc: { type: String, default: '' },
    istimaraExpiry: { type: String, default: '' },
    insuranceExpiry: { type: String, default: '' },
    tpcExpiry: { type: String, default: '' },

    hired: { type: Boolean, required: true, default: false },
    hiredFrom: { type: String, default: '' },

    rentRate: {
      type: rentRateSchema,
      default: null,
    },

    lastRentRate: [
      {
        basis: { type: String },
        rate: { type: Number },
        currency: { type: String },
        changedAt: { type: Date, default: Date.now },
      },
    ],

    outside: { type: Boolean, required: true, default: false },

    certificationBody: {
      type: [certificationBodySchema],
      default: [],
    },

    lastCertificationBody: {
      type: [certificationBodySchema],
      default: [],
    },

    site: {
      type: [String],
      default: [],
    },

    lastSite: {
      type: [String],
      default: [],
    },

    location: {
      type: String,
      default: null,
    },

    lastLocation: {
      type: [String],
      default: [],
    },

    mobDate: {
      type: Date,
      default: null,
    },

    lastMobDate: {
      type: [Date],
      default: [],
    },

    demobDate: {
      type: Date,
      default: null,
    },

    lastDemobDate: {
      type: [Date],
      default: [],
    },

    maintenanceRecord: {
      type: maintenanceRecordSchema,
      default: () => ({}),
    },

    mobilizationsRecord: {
      type: mobilizationsRecordSchema,
      default: () => ({}),
    },

    replacementRecord: {
      type: replacementRecordSchema,
      default: () => ({}),
    },

    activeChainId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    remarks: { type: String, default: '' },

    idleAt: { type: String, enum: ['site', 'garage'], default: 'garage' },
    idleSite: { type: String, default: null },

    hasScheduledDemob: { type: Boolean, default: false },
    scheduledDemobAt: { type: Date, default: null },
    scheduledDemobTime: { type: String, default: '' },
    scheduledDemobRemarks: { type: String, default: '' },

    status: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

equipmentSchema.index({ machine: 1 });
equipmentSchema.index({ category: 1 });
equipmentSchema.index({ category: 1, subCategory: 1 });
equipmentSchema.index({ regNo: 1 });
equipmentSchema.index({ brand: 1 });
equipmentSchema.index({ year: -1 });
equipmentSchema.index({ status: 1 });
equipmentSchema.index({ site: 1 });
equipmentSchema.index({ hired: 1 });
equipmentSchema.index({ hired: 1, year: -1, createdAt: -1 });

equipmentSchema.index({
  machine: 'text',
  regNo: 'text',
  brand: 'text',
  company: 'text',
});

equipmentSchema.index({ 'certificationBody.operatorId': 1 });
equipmentSchema.index({ 'certificationBody.operatorName': 1 });
equipmentSchema.index({ activeChainId: 1 });
equipmentSchema.index({ hasScheduledDemob: 1, scheduledDemobAt: 1 });

module.exports = mongoose.model('Equipments', equipmentSchema);
