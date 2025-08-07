const mongoose = require('mongoose');

// Access Log Schema
const accessLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    },
    raw: String
  },
  geoLocation: {
    country: String,
    region: String,
    city: String,
    timezone: String,
    latitude: Number,
    longitude: Number
  },
  routeAccessed: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked', 'suspicious'],
    default: 'success',
    index: true
  },
  requestHeaders: {
    type: Object,
    default: {}
  },
  sessionId: String,
  referrer: String,
  responseTime: Number,
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
accessLogSchema.index({ userId: 1, timestamp: -1 });
accessLogSchema.index({ ipAddress: 1, timestamp: -1 });
accessLogSchema.index({ status: 1, timestamp: -1 });

// Security Alert Schema
const securityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'SUSPICIOUS_ACTIVITY',
      'BRUTE_FORCE_ATTACK',
      'NEW_LOCATION_ACCESS',
      'IP_BLOCKED',
      'IP_UNBLOCKED',
      'FORCE_LOGOUT',
      'UNUSUAL_ACCESS_PATTERN',
      'MULTIPLE_FAILED_LOGINS',
      'SECURITY_BREACH_ATTEMPT'
    ]
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: Date,
  resolvedNotes: String
}, {
  timestamps: true
});

// Blocked IP Schema
const blockedIPSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reason: {
    type: String,
    required: true
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blockedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  unblockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  unblockedAt: Date,
  expiresAt: Date, // For temporary blocks
  attemptCount: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Login Attempt Schema
const loginAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    },
    raw: String
  },
  geoLocation: {
    country: String,
    region: String,
    city: String,
    timezone: String,
    latitude: Number,
    longitude: Number
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked'],
    required: true,
    index: true
  },
  failureReason: {
    type: String,
    enum: [
      'invalid_credentials',
      'account_locked',
      'account_disabled',
      'ip_blocked',
      'too_many_attempts',
      'invalid_token',
      'expired_token'
    ]
  },
  sessionId: String,
  loginMethod: {
    type: String,
    enum: ['password', 'otp', 'social', 'token'],
    default: 'password'
  }
}, {
  timestamps: true
});

// Indexes for login attempts
loginAttemptSchema.index({ userId: 1, timestamp: -1 });
loginAttemptSchema.index({ ipAddress: 1, status: 1, timestamp: -1 });

// User Session Schema
const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
    deviceType: String,
    raw: String
  },
  geoLocation: {
    country: String,
    region: String,
    city: String,
    timezone: String,
    latitude: Number,
    longitude: Number
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  logoutTime: Date,
  logoutReason: {
    type: String,
    enum: ['user_logout', 'session_expired', 'force_logout', 'duplicate_login']
  },
  logoutBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  tokenHash: String, // Hashed version of session token
  csrfToken: String
}, {
  timestamps: true
});

// Indexes for user sessions
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ sessionId: 1, isActive: 1 });

// Security Configuration Schema
const securityConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  description: String,
  lastModified: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create models
const AccessLog = mongoose.model('AccessLog', accessLogSchema);
const SecurityAlert = mongoose.model('SecurityAlert', securityAlertSchema);
const BlockedIP = mongoose.model('BlockedIP', blockedIPSchema);
const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);
const UserSession = mongoose.model('UserSession', userSessionSchema);
const SecurityConfig = mongoose.model('SecurityConfig', securityConfigSchema);

module.exports = {
  AccessLog,
  SecurityAlert,
  BlockedIP,
  LoginAttempt,
  UserSession,
  SecurityConfig
};