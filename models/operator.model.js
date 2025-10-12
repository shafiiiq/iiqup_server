const mongoose = require('mongoose');

const ToolkitSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    trim: true
  },
  toolkitId: {
    type: String,
    required: [true, 'toolkitId is required'],
    trim: true
  },
  toolkitName: {
    type: String,
    required: [true, 'toolkitName is required'],
    trim: true
  },
  variantId: {
    type: String,
    required: [true, 'variantId is required'],
    trim: true
  },
  size: {
    type: String,
    required: [true, 'Size is required'],
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    trim: true
  },
  assignedDate: {
    type: String,
    required: [true, 'assignedDate is required'],
    trim: true
  },
  reason: {
    type: String,
    required: [true, 'reason is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'quantity is required'],
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: 1,
    default: 5
  },
  status: {
    type: String,
    enum: ['available', 'low', 'out', 'assigned'],
    default: 'available'
  },
  inuse: {
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
  }
});

const profilePicSchema = new mongoose.Schema({
  fileName: { type: String },
  originalName: { type: String },
  filePath: { type: String },
  mimeType: { type: String },
  uploadDate: { type: Date, default: Date.now },
  url: { type: String }
}, { _id: false });


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
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  workmenCompensationAdded: {
    type: String,
    default: 'no',
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
    type: profilePicSchema,
    default: null
  },
  toolkits: [ToolkitSchema],
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
operatorSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Operator = mongoose.model('Operator', operatorSchema);

module.exports = Operator;