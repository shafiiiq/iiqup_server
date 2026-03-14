// models/user.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { USER_ROLES } = require('../constants/user.constants');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const pushTokenSchema = new mongoose.Schema(
  {
    token:        { type: String,  required: true            },
    platform:     { type: String,  enum: ['ios', 'android']  },
    isActive:     { type: Boolean, default: true             },
    registeredAt: { type: Date,    default: Date.now         },
    lastUsed:     { type: Date,    default: Date.now         },
  },
  { _id: false },
);

const grantAccessSchema = new mongoose.Schema(
  {
    purpose: { type: String  },
    data:    { type: Object  },
    granted: { type: Boolean, default: false },
  },
  { _id: false },
);

const specialNotificationSchema = new mongoose.Schema(
  {
    title:       { type: String },
    description: { type: Object },
    time:        { type: Date   },
    priority:    { type: String },
    stockId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: true },
  },
  { _id: false },
);

const trustedDeviceSchema = new mongoose.Schema(
  {
    uniqueCode:      { type: String },
    uniqueCodeIv:    { type: String },
    ipAddress:       { type: String },
    ipAddressIv:     { type: String },
    location:        { type: String },
    locationIv:      { type: String },
    userAgent:       { type: String },
    userAgentIv:     { type: String },
    browserInfo:     { type: String },
    browserInfoIv:   { type: String },
    activatedAt:     { type: Date   },
    lastUsed:        { type: Date   },
    isActive:        { type: Boolean, default: true },
  },
  { _id: false },
);

const signatureActivationSchema = new mongoose.Schema(
  {
    signType:      { type: String, required: true, enum: ['pm', 'wm', 'accounts', 'manager', 'authorized', 'seal'] },
    activationKey: { type: String, required: true }, // bcrypt hashed 20-digit key
    isActivated:   { type: Boolean, default: false },
    activatedAt:   { type: Date    },
    activatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trustedDevices: { type: [trustedDeviceSchema], default: [] },
  },
  { _id: false },
);

const biometricTokenSchema = new mongoose.Schema(
  {
    token:     { type: String,  required: true  },
    isActive:  { type: Boolean, default: true   },
    lastUsed:  { type: Date,    default: Date.now },
    expiresAt: { type: Date,    required: true  },
    deviceInfo: {
      deviceId:  { type: String },
      platform:  { type: String },
      model:     { type: String },
      osVersion: { type: String },
    },
  },
  {
    timestamps: true,
    _id:        false,
  },
);

const exploredFeatureSchema = new mongoose.Schema(
  {
    releaseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Explorer' },
    featureId:  { type: mongoose.Schema.Types.ObjectId                  },
    exploredAt: { type: Date, default: Date.now                         },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // Identity
    name:                { type: String, required: [true, 'Name is required'      ], trim: true                                                                                                                   },
    email:               { type: String, required: [true, 'Email is required'     ], trim: true, lowercase: true,  match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']                                },
    uniqueCode:          { type: String, required: [true, 'UniqueCode is required']                                                                                                                               },
    userType:            { type: String, required: [true, 'UserType is required'  ],                                                                                                default: 'office'             },
    tag:                 { type: String, required: [true, 'tag is required'       ],                                                                                                default: process.env.TAG_CODE },
    department:          { type: String,                                             trim: true                                                                                                                   },

    // Auth
    password:            { type: String, required: [true, 'Password is required'],                                 minlength: [6, 'Password should be at least 6 characters long']                                },
    authMail:            { type: String,                                             trim: true, lowercase: true,  match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'], default: ''                   },                                               
    docAuthPasw:         { type: String                                                                                                                                                                           },
                
    // Role & Access
    role:                { type: String, enum: Object.values(USER_ROLES),                                                                                                           default: 'USER'               },
    permissions:         { type: [Object],                                                                                                                                          default: []                   },
    grantAccess:         { type: [grantAccessSchema],                                                                                                                               default: []                   },

    // Lifecycle
    isActive:            { type: Boolean,                                                                                                                                           default: true                 },
    joiningDate:         { type: Date                                                                                                                                                                             },
    lastLogin:           { type: Date                                                                                                                                                                             },

    // Notifications
    specialNotification: { type: [specialNotificationSchema],                                                                                                                       default: []                   },

    // Devices & Tokens
    pushTokens:          { type: [pushTokenSchema],   
    webPushSubscription: { type: Object, default: null },                                                                                                                              default: []                   },
    biometricTokens:     { type: [biometricTokenSchema],                                                                                                                            default: []                   },
    signatureActivation: { type: [signatureActivationSchema],                                                                                                                       default: []                   },

    // Feature Discovery
    exploredFeatures:    { type: [exploredFeatureSchema], default: [] },
    lastExploredVersion: { type: String,   default: null },
    tutorialsSeen:       { type: [String], default: []   },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

userSchema.index({ email:      1 }, { unique: true });
userSchema.index({ uniqueCode: 1 }, { unique: true });
userSchema.index({ role:       1 });

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

userSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('User', userSchema);