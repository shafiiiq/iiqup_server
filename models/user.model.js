const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the user roles enum
const userRoles = {
  CEO: 'CEO',
  SUPER_ADMIN: 'SUPER_ADMIN',
  CAMP_BOX: 'CAMP_BOSS',
  MD: 'MD',
  MANAGER: 'MANAGER',
  ASSISTANT_MANAGER: 'ASSISTANT_MANAGER',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  WORKSHOP_MANAGER: 'WORKSHOP_MANAGER',
  MAINTENANCE_HEAD: 'MAINTENANCE_HEAD',
  MECHANIC_HEAD: 'MECHANIC_HEAD',
  // Add more roles as needed
};

const userSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    // Removed unique: true from here
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password should be at least 6 characters long']
  },
  role: {
    type: String,
    enum: Object.values(userRoles),
    default: 'USER'
  },
  uniqueCode: {
    type: String,
    required: true
    // Removed unique: true from here
  },
  authMail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    default: ''
  },
  department: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  permissions: {
    type: [String],
    default: []
  },
  userType: {
    type: String,
    required: true,
    default: 'office'
  },
  tag: {
    type: String,
    required: true,
    default: process.env.TAG_CODE
  },
  grantAccess: [{
    purpose: {
      type: String,
    },
    data: {
      type: Object,
    },
    granted: {
      type: Boolean,
      default: false
    }
  }],
  specialNotification: [{
    title: {
      type: String,
    },
    description: {
      type: Object,
    },
    time: {
      type: Date,
    },
    priority: {
      type: String,
    },
    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock', // Reference to the Stock collection
      required: true
    },
  }],
  joiningDate: {
    type: Date,
    required: true
  },
  pushTokens: [{
    token: {
      type: String,   // Expo push token
      required: true
    },
    platform: {
      type: String,   // 'ios' or 'android'
      enum: ['ios', 'android']
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
});

// Method to check if user has specific permission
userSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

// Define indexes only once
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ uniqueCode: 1 }, { unique: true });
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;