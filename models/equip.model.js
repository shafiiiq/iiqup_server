const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  machine: {
    type: String,
    required: true
  },
  regNo: {
    type: String,
    required: true
  },
  coc: {
    type: String,
    default: ""
  },
  brand: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  istimaraExpiry: {
    type: String,
    default: ""
  },
  insuranceExpiry: {
    type: String,
    default: ""
  },
  tpcExpiry: {
    type: String,
    default: ""
  },
  certificationBody: [{
    operatorName: {
      type: String,
      required: true
    },
    operatorId: {
      type: String,
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    }
  }],
  company: {
    type: String,
    default: "ATE",
    required: true
  },
  outside: {
    type: Boolean,
    required: true,
    default: false
  },
  hired: {
    type: Boolean,
    required: true,
    default: false
  },
  status: {
    type: String,
    required: true
  },
  site: [{
    type: String,
    required: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

equipmentSchema.index({ machine: 1 });
equipmentSchema.index({ regNo: 1 });
equipmentSchema.index({ brand: 1 });
equipmentSchema.index({ year: -1 });
equipmentSchema.index({ status: 1 });
equipmentSchema.index({ site: 1 });
equipmentSchema.index({ hired: 1 });

// Compound index for common queries
equipmentSchema.index({ hired: 1, year: -1, createdAt: -1 });

// Text index for full-text search
equipmentSchema.index({
  machine: 'text',
  regNo: 'text',
  brand: 'text',
  company: 'text'
});

// Add index for operator searches
equipmentSchema.index({ 'certificationBody.operatorId': 1 });
equipmentSchema.index({ 'certificationBody.operatorName': 1 });

// Create the model
module.exports = mongoose.model('Equipments', equipmentSchema);