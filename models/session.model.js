// models/session.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const deviceInfoSchema = new mongoose.Schema(
  {
    deviceName:      { type: String },
    deviceModel:     { type: String },
    deviceId:        { type: String },
    brand:           { type: String },
    osName:          { type: String },
    osVersion:       { type: String },
    platform:        { type: String },
    loginTime:       { type: String },
    ipAddress:       { type: String },
    locationAddress: { type: String },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    latitude:  { type: Number },
    longitude: { type: Number },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const sessionSchema = new mongoose.Schema(
  {
    // Identity
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userModel',
    },
    userModel: { type: String, required: true, enum: ['User', 'Operator', 'Mechanic'] },
    sessionToken: { type: String, required: true, unique: true },

    // Device & Location
    deviceInfo: { type: deviceInfoSchema  },
    location:   { type: locationSchema    },

    // Lifecycle
    isActive:     { type: Boolean, default: true     },
    lastActivity: { type: Date,    default: Date.now },
    expiresAt:    { type: Date,    required: true     },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

sessionSchema.index({ userId:       1, isActive: 1 });
sessionSchema.index({ sessionToken: 1              });
sessionSchema.index({ expiresAt:    1 }, { expireAfterSeconds: 0 }); // TTL

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Session', sessionSchema);