const mongoose = require('mongoose');

const EQUIPMENT_STATUSES = [
  'active',
  'idle',
  'maintenance',
  'loading',
  'going',
  'leased',
  'sold',
];

const mobilizationSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipments',
      required: true,
    },
    regNo: { type: String, required: true },
    machine: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: ['mobilized', 'demobilized', 'status_changed'],
    },
    previousStatus: { type: String, enum: EQUIPMENT_STATUSES },
    newStatus: { type: String, enum: EQUIPMENT_STATUSES },
    status: {
      type: String,
      required: true,
      enum: EQUIPMENT_STATUSES,
      default: function () {
        return this.action === 'mobilized' ? 'active' : 'idle';
      },
    },

    // Deployment
    deployType: { type: String, enum: ['site', 'company'], default: 'site' },
    clientCompany: { type: String, default: '' },
    site: {
      type: String,
      required: function () {
        return this.action === 'mobilized' && this.deployType === 'site';
      },
    },
    withOperator: { type: Boolean, required: true, default: false },
    operators: [
      {
        operatorName: String,
        operatorId: String,
        shiftName: String,
        shiftStart: String,
        shiftEnd: String,
      },
    ],
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    time: { type: String, required: true },
    isOneDayMob: { type: Boolean, default: false },
    demobDate: { type: Date, default: null },
    demobTime: { type: String, default: '' },
    demobRemarks: { type: String, default: '' },
    operator: { type: String, default: '' },
    previousOperators: [
      {
        operatorName: { type: String, default: '' },
        operatorId: { type: String, default: '' },
        shiftName: { type: String, default: '' },
        shiftStart: { type: String, default: '' },
        shiftEnd: { type: String, default: '' },
      },
    ],
    hired: { type: Boolean, default: false },
    hiredFrom: { type: String, default: '' },
    rentRate: { type: Object, default: null },
    location: { type: String, default: '' },
    lastMobilizedDate: { type: String, default: '' },
    lastMobilizedTime: { type: String, default: '' },
    linkedMobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mobilization',
      default: null,
    },
    remarks: { type: String, default: '' },
    chainId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: true,
  }
);

mobilizationSchema.index({ equipmentId: 1 });
mobilizationSchema.index({ regNo: 1 });
mobilizationSchema.index({ action: 1 });
mobilizationSchema.index({ site: 1 });
mobilizationSchema.index({ status: 1 });
mobilizationSchema.index({ date: -1 });
mobilizationSchema.index({ year: -1, month: -1 });
mobilizationSchema.index({ equipmentId: 1, action: 1, date: -1 });
mobilizationSchema.index({ site: 1, status: 1 });

module.exports = mongoose.model('Mobilization', mobilizationSchema);
