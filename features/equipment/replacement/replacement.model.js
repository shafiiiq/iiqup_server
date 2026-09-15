const mongoose = require('mongoose');

const replacementSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipments',
      required: true,
    },
    regNo: { type: String, required: true },
    machine: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['operator', 'site', 'equipment'],
    },
    status: {
      type: String,
      required: true,
      enum: ['idle', 'active'],
      default: 'active',
    },
    date: { type: Date, required: true, default: Date.now },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    time: { type: String, required: true },
    currentOperator: {
      type: String,
      default: '',
      validate: {
        validator: function (v) {
          if (this.type === 'operator' && !this.replaceAll) {
            return v && v.trim().length > 0;
          }
          return true;
        },
        message: 'currentOperator is required for operator replacements',
      },
    },
    previousOperators: [
      {
        operatorName: { type: String, default: '' },
        operatorId: { type: String, default: '' },
        shiftName: { type: String, default: '' },
        shiftStart: { type: String, default: '' },
        shiftEnd: { type: String, default: '' },
      },
    ],
    currentOperatorId: { type: String, default: '' },
    outgoingOperator: { type: String, default: '' },
    outgoingOperatorId: { type: String, default: '' },
    incomingOperator: { type: String, default: '' },
    incomingOperatorId: { type: String, default: '' },
    replacedOperator: {
      type: String,
      required: function () {
        return this.type === 'operator';
      },
    },
    replacedOperatorId: {
      type: String,
      required: function () {
        return this.type === 'operator';
      },
    },
    shiftName: { type: String, default: '' },
    shiftStart: { type: String, default: '' },
    shiftEnd: { type: String, default: '' },
    targetShiftName: { type: String, default: '' },
    replaceAll: { type: Boolean, default: false },
    currentSite: {
      type: String,
      required: function () {
        return this.type === 'site';
      },
    },
    replacedSite: {
      type: String,
      required: function () {
        return this.type === 'site';
      },
    },
    replacedEquipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipments',
      required: function () {
        return this.type === 'equipment';
      },
    },
    replacedEquipmentRegNo: { type: String, default: '' },
    replacedEquipmentMachine: { type: String, default: '' },
    newSiteForReplaced: { type: String, default: '' },
    site: { type: String, default: '' },
    remainingShifts: [
      {
        operatorName: { type: String, default: '' },
        operatorId: { type: String, default: '' },
        shiftName: { type: String, default: '' },
        shiftStart: { type: String, default: '' },
        shiftEnd: { type: String, default: '' },
        assignedAt: { type: Date, default: null },
      },
    ],
    hired: { type: Boolean, default: false },
    hiredFrom: { type: String, default: '' },
    rentRate: { type: Object, default: null },
    location: { type: [String], default: [] },
    remarks: { type: String, default: '' },
    chainId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: true,
  }
);

replacementSchema.index({ equipmentId: 1 });
replacementSchema.index({ regNo: 1 });
replacementSchema.index({ type: 1 });
replacementSchema.index({ status: 1 });
replacementSchema.index({ date: -1 });
replacementSchema.index({ year: -1, month: -1 });
replacementSchema.index({ equipmentId: 1, type: 1, date: -1 });
replacementSchema.index({ currentOperator: 1, type: 1 });
replacementSchema.index({ replacedOperator: 1, type: 1 });
replacementSchema.index({ currentSite: 1, type: 1 });
replacementSchema.index({ replacedSite: 1, type: 1 });
replacementSchema.index({ replacedEquipmentId: 1, type: 1 });
replacementSchema.index({ chainId: 1 });

module.exports = mongoose.model('Replacement', replacementSchema);
