// models/notification.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const deliveryReceiptSchema = new mongoose.Schema(
  {
    uniqueCode:  { type: String },
    deliveredAt: { type: Date   },
  },
  { _id: false },
);

const readReceiptSchema = new mongoose.Schema(
  {
    uniqueCode: { type: String },
    readAt:     { type: Date   },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const notificationSchema = new mongoose.Schema(
  {
    // Content
    title:       { type: String },
    description: { type: Object },
    priority:    { type: String },
    time:        { type: Date   },

    // Navigation
    hasButton:     { type: Boolean, default: false },
    navigateText:  { type: String                  },
    navigateTo:    { type: String                  },
    navigteToId:   { type: String                  },  
    sourceId:      { type: String                  }, 
    type:        { type: String, default: 'normal'  },
    category:    { type: String, default: 'general' },

    // Approval
    directApproval: { type: Boolean, default: false },
    approvalPort:   { type: String                  },

    // Targeting
    isBroadcast: { type: Boolean,   default: false },  
    targetUsers: { type: [String],  default: []    },  
    deliveredTo: { type: [deliveryReceiptSchema], default: [] },
    forYou:      { type: [String], default: []    },
    visibleTo:   { type: [String], default: []    },
    readBy:      { type: [readReceiptSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Notifications', notificationSchema);