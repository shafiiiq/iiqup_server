const mongoose = require('mongoose');

const locationTrackingSchema = new mongoose.Schema({
  uniqueCode: {
    type: String,
    required: true,
    index: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  placeName: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  accuracy: {
    type: Number,
    default: 0
  },
  speed: {
    type: Number,
    default: 0
  },
  heading: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isWorkingHours: {
    type: Boolean,
    default: false
  },
  trackingDate: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
locationTrackingSchema.index({ uniqueCode: 1, trackingDate: 1, timestamp: 1 });
locationTrackingSchema.index({ uniqueCode: 1, isWorkingHours: 1, timestamp: -1 });

// TTL index to automatically delete old location data after 30 days
locationTrackingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('LocationTracking', locationTrackingSchema);