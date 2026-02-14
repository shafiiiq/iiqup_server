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
  SUB_ASSISTANT_MANAGER: 'SUB_ASSISTANT_MANAGER',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  WORKSHOP_MANAGER: 'WORKSHOP_MANAGER',
  MAINTENANCE_HEAD: 'MAINTENANCE_HEAD',
  MECHANIC_HEAD: 'MECHANIC_HEAD',
  GUEST_USER: 'GUEST_USER',
  ACCOUNTANT: 'ACCOUNTANT',
  ASSISTANT_ACCOUNTANT: 'ASSISTANT_ACCOUNTANT',
  OFFICE_ADMIN: 'OFFICE_ADMIN',
  ASSISTANT_OFFICE_ADMIN: 'ASSISTANT_OFFICE_ADMIN',
  SUB_ADMIN: 'SUB_ADMIN',
  SUB_ACCOUNTANT: 'SUB_ACCOUNTANT',
  JALEEL_KA: 'JALEEL_KA',
  CHARISHMA: 'CHARISHMA',
  SUB_MANAGER: 'SUB_MANAGER',
  SUB_MANAGER_TWO: 'SUB_MANAGER_TWO',
  PRO: 'PRO',
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
    type: [Object],
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
  },
  docAuthPasw: {
    type: String
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
  signatureActivation: [{
    signType: {
      type: String,
      enum: ['pm', 'accounts', 'manager', 'authorized', 'seal'],
      required: true
    },
    activationKey: {
      type: String,
      required: true // Store bcrypt hashed 20-digit key
    },
    trustedDevices: [{
      uniqueCode: String,
      uniqueCodeIv: String,
      ipAddress: String,
      ipAddressIv: String,
      location: String,
      locationIv: String,
      userAgent: String,
      userAgentIv: String,
      browserInfo: String,
      browserInfoIv: String,
      activatedAt: Date,
      lastUsed: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    isActivated: {
      type: Boolean,
      default: false
    },
    activatedAt: Date,
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
  }],
  biometricTokens: [{
    token: {
      type: String,
      required: true
    },
    deviceInfo: {
      deviceId: String,
      platform: String,
      model: String,
      osVersion: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
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
  exploredFeatures: [{
    releaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Explorer'
    },
    featureId: {
      type: mongoose.Schema.Types.ObjectId
    },
    exploredAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastExploredVersion: {
    type: String,
    default: null
  }
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