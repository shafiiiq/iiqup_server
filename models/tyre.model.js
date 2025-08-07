const mongoose = require('mongoose');

const TyreHistorySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  tyreModel: {
    type: String,
    required: true
  },
  tyreNumber: {
    type: String,
    required: true
  },
  equipment: {
    type: String,
    required: true
  },
  equipmentNo: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    required: true
  },
  runningHours: {
    type: String, // Can be changed to Number if only numeric values are expected
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

module.exports = mongoose.model('TyreHistory', TyreHistorySchema);