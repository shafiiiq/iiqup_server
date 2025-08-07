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
  certificationBody: {
    type: [String],
    default: [""]
  },
  company: {
    type: String,
    default: "ATE",
    required: true
  },
  outside: {
    type: Boolean,
    required: true
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


// Create the model
module.exports = mongoose.model('Equipments', equipmentSchema);

