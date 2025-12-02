const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'userModel'
    },
    userModel: {
        type: String,
        required: true,
        enum: ['User', 'Operator', 'Mechanic']
    },
    sessionToken: {
        type: String,
        required: true,
        unique: true
    },
    deviceInfo: {
        deviceName: String,
        deviceModel: String,
        deviceId: String,
        brand: String,
        osName: String,
        osVersion: String,
        platform: String,
        loginTime: String,
        ipAddress: String, 
        locationAddress: String
    },
    location: {
        latitude: Number,
        longitude: Number
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Index for faster queries
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ sessionToken: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);