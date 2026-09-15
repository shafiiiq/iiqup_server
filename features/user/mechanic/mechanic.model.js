const mongoose = require('mongoose');

const toolkitSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    toolkitId: { type: String, required: [true, 'toolkitId is required'], trim: true, default: 'No One', },
    toolkitName: { type: String, required: [true, 'toolkitName is required'], trim: true, default: 'No One', },
    variantId: { type: String, required: [true, 'variantId is required'], trim: true, default: 'No One', },
    size: { type: String, required: [true, 'Size is required'], trim: true },
    color: { type: String, required: [true, 'Color is required'], trim: true },
    quantity: { type: Number, required: [true, 'quantity is required'], min: 0, default: 0, },
    minStockLevel: { type: Number, required: [true, 'Minimum stock level is required'], min: 1, default: 5, },
    status: { type: String, enum: ['available', 'low', 'out', 'assigned'], default: 'available', },
    inuse: { type: Boolean, default: false },
    assignedDate: { type: String, required: [true, 'assignedDate is required'], trim: true, default: () => new Date().toISOString(), },
    reason: { type: String, required: [true, 'reason is required'], trim: true, default: 'No Reason', },
  },
  { timestamps: true, }
);

const attendanceRecordSchema = new mongoose.Schema(
  {
    id: { type: Number },
    pin: { type: Number },
    punch_time: { type: String },
    punch_state: { type: String },
    emp_name: { type: String },
    verify_type: { type: String },
    work_code: { type: String },
    gps_location: { type: String },
    terminal_alias: { type: String },
    capture: { type: String },
    upload_time: { type: String },
    icon: { type: String },
    location: { type: String },
    photo: { type: String },
  },
  { _id: false }
);

const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android'] },
    isActive: { type: Boolean, default: true },
    registeredAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now },
  },
  { _id: false }
);


const mechanicSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Mechanic name is required'], trim: true, },
    userId: { type: Number, required: [true, 'User ID is required'], ref: 'User', },
    uniqueCode: { type: String },
    userType: { type: String, default: 'mechanic' },
    tag: { type: String, default: process.env.TAG_CODE },
    zktecoPin: { type: Number },
    status: { type: String },
    email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'], },
    authMail: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'], default: '', },
    password: { type: String, minlength: [6, 'Password should be at least 6 characters long'], },
    isActive: { type: Boolean, default: false },
    toolkits: { type: [toolkitSchema], default: [] },
    attendance: { type: [attendanceRecordSchema], default: [] },
    pushTokens: { type: [pushTokenSchema], default: [] },
    permissions: {type: Array, default: []},
  },
  {
    timestamps: true,
  }
);

toolkitSchema.pre('save', function (next) {
  if (this.stockCount <= 0) this.status = 'out';
  else if (this.stockCount < this.minStockLevel) this.status = 'low';
  else this.status = 'available';
  next();
});


mechanicSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});


module.exports = mongoose.model('Mechanic', mechanicSchema);
