const mongoose = require('mongoose')

const toolkitSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    toolkitId: { type: String, required: [true, 'toolkitId is required'], trim: true },
    toolkitName: { type: String, required: [true, 'toolkitName is required'], trim: true },
    variantId: { type: String, required: [true, 'variantId is required'], trim: true },
    size: { type: String, required: [true, 'Size is required'], trim: true },
    color: { type: String, required: [true, 'Color is required'], trim: true },
    quantity: { type: Number, required: [true, 'quantity is required'], min: 0, default: 0 },
    minStockLevel: { type: Number, required: [true, 'Minimum stock level is required'], min: 1, default: 5 },
    status: { type: String, enum: ['available', 'low', 'out', 'assigned'], default: 'available' },
    inuse: { type: Boolean, default: false },
    assignedDate: { type: String, required: [true, 'assignedDate is required'], trim: true },
    reason: { type: String, required: [true, 'reason is required'], trim: true },
  },
  { timestamps: true }
)

const profilePicSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    originalName: { type: String },
    filePath: { type: String },
    mimeType: { type: String },
    uploadDate: { type: Date, default: Date.now },
    url: { type: String },
  },
  { _id: false }
)

const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android'] },
    isActive: { type: Boolean, default: true },
    registeredAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now },
  },
  { _id: false }
)

const rentRateSchema = new mongoose.Schema(
  {
    basis: {
      type: String,
      enum: ['daily', 'hourly', 'weekly', 'monthly', 'trip'],
      default: 'daily',
    },
    rate: { type: Number, default: 0 },
    currency: { type: String, default: 'QAR' },
  },
  { _id: false }
)

const operatorSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    slNo: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    uniqueCode: { type: String, required: true, unique: true, trim: true },
    userType: { type: String, required: true, default: 'operator' },
    qatarId: { type: String, required: true, unique: true, trim: true },
    nationality: { type: String, default: '' },
    sponsorship: { type: String, default: '' },
    workingIn: { type: String, default: '' },
    contactNo: { type: String, default: '' },
    dob: { type: Date, default: null },
    doj: { type: Date, default: null },
    passportNo: { type: String, default: '' },
    passportExpiry: { type: Date, default: null },
    qidExpiry: { type: Date, default: null },
    healthCardExpiry: { type: Date, default: null },
    licenceType: { type: String, default: '' },
    licenceExpiry: { type: Date, default: null },
    labourContractExpiry: { type: mongoose.Schema.Types.Mixed, default: null },
    workmenCompensationAdded: { type: String, default: 'no' },
    equipmentNumber: { type: String, default: '' },
    hired: { type: Boolean, required: true, default: false },
    hiredFrom: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    password: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    profilePic: { type: profilePicSchema, default: () => ({}) },
    toolkits: { type: [toolkitSchema], default: [] },
    pushTokens: { type: [pushTokenSchema], default: [] },
    permissions: { type: Array, default: [] },

    designation: { type: String, default: '' },
    rentRate: { type: rentRateSchema, default: null },
    lastRentRate: [
      {
        basis: { type: String },
        rate: { type: Number },
        currency: { type: String },
        changedAt: { type: Date, default: Date.now },
      },
    ],

    status: { type: String, enum: ['mobilized', 'demobilized'], default: 'demobilized' },
    site: { type: [String], default: [] },
    lastSite: { type: [String], default: [] },
    mobDate: { type: Date, default: null },
    lastMobDate: { type: [Date], default: [] },
    demobDate: { type: Date, default: null },
    lastDemobDate: { type: [Date], default: [] },
  },
  { timestamps: true }
)

operatorSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

operatorSchema.index({ status: 1 })
operatorSchema.index({ hired: 1, status: 1 })

module.exports = mongoose.model('Operator', operatorSchema)