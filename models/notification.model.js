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
    navigteToId:   { type: String                  }, // Note: typo preserved for backward compatibility
    sourceId:      { type: String                  },

    // Approval
    directApproval: { type: Boolean, default: false },
    approvalPort:   { type: String                  },

    // Targeting
    isBroadcast: { type: Boolean,   default: false }, // true = send to all users
    targetUsers: { type: [String],  default: []    }, // array of uniqueCodes
    deliveredTo: { type: [deliveryReceiptSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Notifications', notificationSchema);