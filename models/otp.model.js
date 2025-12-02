const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const otpSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  otp: {
    type: String,
    required: true,
    // OTP is now stored as a bcrypt hash
    // Hash format: $2b$12$... (60 characters)
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  verified: {
    type: Boolean,
    default: false,
    index: true
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 10 // Absolute maximum
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Compound index for faster queries
otpSchema.index({ email: 1, verified: 1 });

// TTL index: automatically remove documents after they expire
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Additional cleanup: remove verified OTPs after 1 hour
otpSchema.index({ verified: 1, createdAt: 1 }, { 
  expireAfterSeconds: 3600,
  partialFilterExpression: { verified: true }
});

// Pre-save middleware to ensure security constraints
otpSchema.pre('save', function(next) {
  // Ensure attempts don't exceed maximum
  if (this.attempts > 10) {
    this.attempts = 10;
  }
  next();
});

// Method to check if OTP is expired
otpSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to check if OTP can still be attempted
otpSchema.methods.canAttempt = function(maxAttempts = 5) {
  return this.attempts < maxAttempts && !this.verified && !this.isExpired();
};

// Static method to clean up old OTPs (can be called by cron job)
otpSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { 
        verified: true, 
        createdAt: { $lt: new Date(Date.now() - 3600000) } // 1 hour old
      }
    ]
  });
  return result;
};

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;