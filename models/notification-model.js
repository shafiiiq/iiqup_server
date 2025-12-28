const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  hasButton: {
    type: Boolean,
    default: false
  },
  navigateText: {
    type: String
  },
  navigateTo: {
    type: String
  },
  sourceId: {
    type: String
  },
  navigteToId: {
    type: String
  },
  directApproval: {
    type: Boolean,
    default: false
  },
  approvalPort: {
    type: String
  },
  targetUsers: [{
    type: String, // Array of uniqueCodes
    default: []
  }],
  isBroadcast: {
    type: Boolean,
    default: false // true = send to all users
  },
  deliveredTo: [{
    uniqueCode: String,
    deliveredAt: Date
  }]
});

module.exports = mongoose.model('Notifications', NotificationSchema);