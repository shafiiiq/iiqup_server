// models/chats.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const participantSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    userType:   { type: String, enum: ['office', 'mechanic', 'operator'], required: true },
    uniqueCode: { type: String, required: true },
    name:       { type: String },
    avatar:     { type: String },
  },
  { _id: false },
);

const lastMessageSenderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId },
    name:   { type: String },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const chatSchema = new mongoose.Schema(
  {
    // Identity
    type:     { type: String, enum: ['individual', 'group'], required: true },
    teamType: { type: String, enum: ['maintenance', 'operations', 'admin', 'mechanic', 'operators'], required: true },
    name:     { type: String }, // Required for groups only
    avatar:   { type: String }, // Group avatar/emoji

    // Participants
    participants: { type: [participantSchema], default: [] },

    // Last Message
    lastMessage:       { type: String, default: ''         },
    lastMessageTime:   { type: Date,   default: Date.now   },
    lastMessageSender: { type: lastMessageSenderSchema     },

    // Unread Tracking (key: userId, value: unread count)
    unreadCount: { type: Map, of: Number, default: {} },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

chatSchema.index({ 'participants.userId':     1  });
chatSchema.index({ 'participants.uniqueCode': 1  });
chatSchema.index({ teamType:                  1  });
chatSchema.index({ lastMessageTime:           -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Chat', chatSchema);