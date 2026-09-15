const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0, min: 0, max: 10 },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, verified: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index(
  { verified: 1, createdAt: 1 },
  { expireAfterSeconds: 3600, partialFilterExpression: { verified: true } }
);

otpSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

otpSchema.methods.canAttempt = function (maxAttempts = 5) {
  return this.attempts < maxAttempts && !this.verified && !this.isExpired();
};

otpSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { verified: true, createdAt: { $lt: new Date(Date.now() - 3_600_000) } },
    ],
  });
};

otpSchema.pre('save', function (next) {
  if (this.attempts > 10) this.attempts = 10;
  next();
});

module.exports = mongoose.model('OTP', otpSchema);