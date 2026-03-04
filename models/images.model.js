const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  }
});

const equipmentHandoverSchema = new mongoose.Schema({
  equipmentName: {
    type: String,
    required: true,
    trim: true
  },
  equipmentNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  images: {
    type: [imageSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('EquipmentHandover', equipmentHandoverSchema);