const mongoose = require('mongoose');

const operatorMobilizationSchema = new mongoose.Schema(
  {
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true },
    operatorName: { type: String, required: true },
    qatarId: { type: String, default: '' },

    action: { type: String, required: true, enum: ['mobilized', 'demobilized', 'replaced'] },
    status: { type: String, required: true, enum: ['mobilized', 'demobilized', 'replaced'] },
    origin: { type: String, enum: ['equipment', 'operator', 'replacement'], default: 'equipment' },
    mode: { type: String, enum: ['operator-only', 'with-equipment'], default: 'with-equipment' },

    regNo: { type: String, default: '' },
    machine: { type: String, default: '' },
    site: { type: String, default: '' },
    deployType: { type: String, enum: ['site', 'company'], default: 'site' },
    clientCompany: { type: String, default: '' },

    designation: { type: String, default: '' },
    rentRate: { type: Object, default: null },

    shiftName: { type: String, default: '' },
    shiftStart: { type: String, default: '' },
    shiftEnd: { type: String, default: '' },

    hired: { type: Boolean, default: false },
    hiredFrom: { type: String, default: '' },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    time: { type: String, required: true },

    remarks: { type: String, default: '' },

    outgoingOperatorId: { type: String, default: '' },
    outgoingOperatorName: { type: String, default: '' },
    incomingOperatorId: { type: String, default: '' },
    incomingOperatorName: { type: String, default: '' },
  },
  { timestamps: true }
);

operatorMobilizationSchema.index({ operatorId: 1 });
operatorMobilizationSchema.index({ action: 1 });
operatorMobilizationSchema.index({ regNo: 1 });
operatorMobilizationSchema.index({ date: -1 });
operatorMobilizationSchema.index({ operatorId: 1, action: 1, date: -1 });
operatorMobilizationSchema.index({ origin: 1, date: -1 });

module.exports = mongoose.model('OperatorMobilization', operatorMobilizationSchema);