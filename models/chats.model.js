// chats.model.js
const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['individual', 'group'],
      required: true,
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        userType: {
          type: String,
          enum: ['office', 'mechanic', 'operator'],
          required: true,
        },
        uniqueCode: {
          type: String,
          required: true,
        },
        name: {
          type: String,
        },
        avatar: {
          type: String,
        },
      },
    ],
    teamType: {
      type: String,
      enum: ['maintenance', 'operations', 'admin', 'mechanic', 'operators'],
      required: true,
    },
    name: {
      type: String,
      // Required only for groups
    },
    avatar: {
      type: String,
      // Group avatar/emoji
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
    },
    lastMessageSender: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
      // Key: userId, Value: unread count for that user
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ 'participants.uniqueCode': 1 });
chatSchema.index({ teamType: 1 });
chatSchema.index({ lastMessageTime: -1 });

module.exports = mongoose.model('Chat', chatSchema);