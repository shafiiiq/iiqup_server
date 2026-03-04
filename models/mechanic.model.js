// models/mechanic.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const toolkitSchema = new mongoose.Schema(
  {
    // Identity
    name:        { type: String, trim: true },
    type:        { type: String, trim: true },
    toolkitId:   { type: String, required: [true, 'toolkitId is required'],   trim: true, default: 'No One' },
    toolkitName: { type: String, required: [true, 'toolkitName is required'], trim: true, default: 'No One' },
    variantId:   { type: String, required: [true, 'variantId is required'],   trim: true, default: 'No One' },

    // Attributes
    size:  { type: String, required: [true, 'Size is required'],  trim: true },
    color: { type: String, required: [true, 'Color is required'], trim: true },

    // Stock
    quantity:      { type: Number, required: [true, 'quantity is required'],              min: 0, default: 0 },
    minStockLevel: { type: Number, required: [true, 'Minimum stock level is required'],   min: 1, default: 5 },
    status:        { type: String, enum: ['available', 'low', 'out', 'assigned'], default: 'available'       },
    inuse:         { type: Boolean, default: false                                                            },

    // Assignment
    assignedDate: { type: String, required: [true, 'assignedDate is required'], trim: true, default: () => new Date().toISOString() },
    reason:       { type: String, required: [true, 'reason is required'],       trim: true, default: 'No Reason'                    },
  },
  {
    timestamps: true,
  },
);

const overtimeEntrySchema = new mongoose.Schema(
  {
    date:          { type: Date,     required: [true, 'Date is required'] },
    formattedDate: { type: String,   required: true                       }, // dd-mm-yyyy
    totalTime:     { type: Number,   default: 0                           }, // minutes
    formattedTime: { type: String,   default: ''                          },
    regNo:         { type: [Number], default: []                          },
    workDetails:   { type: [String], default: []                          },
    times: {
      type: [
        new mongoose.Schema(
          { in: { type: Date, required: true }, out: { type: Date } },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

const monthlyOvertimeSchema = new mongoose.Schema(
  {
    month:              { type: String, required: true }, // "Month Year" e.g. "May 2025"
    totalMonthTime:     { type: Number, default: 0     }, // minutes
    formattedMonthTime: { type: String, default: '0h 0m' },
    entries:            { type: [overtimeEntrySchema], default: [] },
  },
  { _id: false },
);

const attendanceRecordSchema = new mongoose.Schema(
  {
    id:             { type: Number },
    pin:            { type: Number },
    punch_time:     { type: String },
    punch_state:    { type: String },
    emp_name:       { type: String },
    verify_type:    { type: String },
    work_code:      { type: String },
    gps_location:   { type: String },
    terminal_alias: { type: String },
    capture:        { type: String },
    upload_time:    { type: String },
    icon:           { type: String },
    location:       { type: String },
    photo:          { type: String },
  },
  { _id: false },
);

const pushTokenSchema = new mongoose.Schema(
  {
    token:        { type: String,  required: true                        },
    platform:     { type: String,  enum: ['ios', 'android']             },
    isActive:     { type: Boolean, default: true                        },
    registeredAt: { type: Date,    default: Date.now                    },
    lastUsed:     { type: Date,    default: Date.now                    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const mechanicSchema = new mongoose.Schema(
  {
    // Identity
    name:       { type: String, required: [true, 'Mechanic name is required'], trim: true },
    userId:     { type: Number, required: [true, 'User ID is required'], ref: 'User'      },
    uniqueCode: { type: String },
    userType:   { type: String, default: 'mechanic'           },
    tag:        { type: String, default: process.env.TAG_CODE },
    zktecoPin:  { type: Number },
    status:     { type: String },

    // Auth
    email: {
      type:  String,
      trim:  true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    authMail: {
      type:      String,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      default:   '',
    },
    password: {
      type:      String,
      minlength: [6, 'Password should be at least 6 characters long'],
    },

    // Flags
    isActive: { type: Boolean, default: false },

    // Relations
    toolkits:        { type: [toolkitSchema],          default: [] },
    monthlyOvertime: { type: [monthlyOvertimeSchema],  default: [] },
    attendance:      { type: [attendanceRecordSchema], default: [] },
    pushTokens:      { type: [pushTokenSchema],        default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

toolkitSchema.pre('save', function (next) {
  if (this.stockCount <= 0)                    this.status = 'out';
  else if (this.stockCount < this.minStockLevel) this.status = 'low';
  else                                           this.status = 'available';
  next();
});

overtimeEntrySchema.pre('save', function (next) {
  let totalMinutes = 0;

  this.times?.forEach(({ in: inTime, out }) => {
    if (inTime && out && out > inTime) {
      totalMinutes += Math.floor((out - inTime) / (1000 * 60));
    }
  });

  this.totalTime     = totalMinutes;
  this.formattedTime = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

  const d = new Date(this.date);
  this.formattedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

  next();
});

monthlyOvertimeSchema.pre('save', function (next) {
  const total            = this.entries?.reduce((sum, e) => sum + e.totalTime, 0) ?? 0;
  this.totalMonthTime    = total;
  this.formattedMonthTime = `${Math.floor(total / 60)}h ${total % 60}m`;
  next();
});

mechanicSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Mechanic', mechanicSchema);