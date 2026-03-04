// models/otp.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const otpSchema = new mongoose.Schema(
  {
    // Identity
    email: {
      type:      String,
      required:  true,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },

    // OTP (stored as bcrypt hash: $2b$12$... 60 chars)
    otp: { type: String, required: true },

    // Lifecycle
    expiresAt: { type: Date,    required: true },
    verified:  { type: Boolean, default: false },
    attempts:  { type: Number,  default: 0, min: 0, max: 10 },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Compound
otpSchema.index({ email: 1, verified: 1 });

// TTL — auto-remove expired documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// TTL — auto-remove verified OTPs after 1 hour
otpSchema.index(
  { verified: 1, createdAt: 1 },
  { expireAfterSeconds: 3600, partialFilterExpression: { verified: true } },
);

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

otpSchema.methods.isExpired  = function ()                   { return this.expiresAt < new Date(); };
otpSchema.methods.canAttempt = function (maxAttempts = 5)    { return this.attempts < maxAttempts && !this.verified && !this.isExpired(); };

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

otpSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { verified: true, createdAt: { $lt: new Date(Date.now() - 3_600_000) } },
    ],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

otpSchema.pre('save', function (next) {
  if (this.attempts > 10) this.attempts = 10;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('OTP', otpSchema);