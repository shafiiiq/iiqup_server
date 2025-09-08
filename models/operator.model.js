const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  slNo: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  userType: {
    type: String,
    required: true,
    default: 'operator'
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nationality: {
    type: String,
    default: ''
  },
  sponsorship: {
    type: String,
    default: ''
  },
  workingIn: {
    type: String,
    default: ''
  },
  doj: {
    type: Date,
    default: null
  },
  passportNo: {
    type: String,
    default: ''
  },
  passportExpiry: {
    type: Date,
    default: null
  },
  qatarId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  qidExpiry: {
    type: Date,
    default: null
  },
  healthCardExpiry: {
    type: Date,
    default: null
  },
  licenceType: {
    type: String,
    default: ''
  },
  licenceExpiry: {
    type: Date,
    default: null
  },
  labourContractExpiry: {
    type: Date,
    default: null
  },
  workmenCompensationAdded: {
    type: String,
    enum: ['yes', 'no'],
    default: 'no'
  },
  contactNo: {
    type: String,
    default: ''
  },
  dob: {
    type: Date,
    default: null
  },
  email: {
    type: String,
    default: '',
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    default: ''
  },
  equipmentNumber: {
    type: String,
    default: ''
  },
  profilePic: {
    type: String,
    default: ''
  },
  toolkits: [{
    type: String
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
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

// Update the updatedAt field before saving
operatorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Operator = mongoose.model('Operator', operatorSchema);

module.exports = Operator;