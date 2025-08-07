const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  qatarId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  equipmentNumber: {
    type: String,
    required: true,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  userType: {
    type: String,
    required: true
  }
});

// Update the updatedAt field before saving
operatorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Operator = mongoose.model('Operator', operatorSchema);

module.exports = Operator;