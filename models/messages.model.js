// messages.model.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'mechanic', 'operator'],
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'voice', 'document', 'location'],
      default: 'text',
      required: true,
    },
    content: {
      type: String,
      required: true,
      // For text: the message text
      // For files: the file URL
      // For location: JSON string with coordinates
    },
    fileName: {
      type: String,
      // Original file name for documents
    },
    fileSize: {
      type: Number,
      // File size in bytes
    },
    duration: {
      type: Number,
      // Duration in seconds for audio/voice/video
    },
    thumbnail: {
      type: String,
      // Thumbnail URL for videos
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deliveredTo: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    replyTo: {
      messageId: mongoose.Schema.Types.ObjectId,
      content: String,
      senderName: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        // Users who deleted this message
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'readBy.userId': 1 });

module.exports = mongoose.model('Message', messageSchema);