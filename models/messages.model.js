// models/messages.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const readReceiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: Date.now                        },
  },
  { _id: false },
);

const deliveryReceiptSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, required: true },
    deliveredAt: { type: Date, default: Date.now                        },
  },
  { _id: false },
);

const replyToSchema = new mongoose.Schema(
  {
    messageId:  { type: mongoose.Schema.Types.ObjectId },
    content:    { type: String },
    senderName: { type: String },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const messageSchema = new mongoose.Schema(
  {
    // References
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },

    // Sender
    senderId:     { type: mongoose.Schema.Types.ObjectId, required: true                              },
    senderType:   { type: String, enum: ['office', 'mechanic', 'operator'],  required: true           },
    senderName:   { type: String, required: true                                                       },
    senderAvatar: { type: String                                                                       },

    // Content
    messageType: {
      type:     String,
      enum:     ['text', 'image', 'video', 'audio', 'voice', 'document', 'location', 'voice call'],
      default:  'text',
      required: true,
    },
    content:   { type: String, required: true }, // text | file URL | location JSON
    fileName:  { type: String },                 // Documents only
    fileSize:  { type: Number },                 // Bytes
    duration:  { type: Number },                 // Seconds — audio/voice/video
    thumbnail: { type: String },                 // Videos only

    // Delivery State
    status:      { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
    readBy:      { type: [readReceiptSchema],    default: [] },
    deliveredTo: { type: [deliveryReceiptSchema], default: [] },

    // Threading
    replyTo: { type: replyToSchema },

    // Deletion
    isDeleted:  { type: Boolean,                                default: false },
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: []         },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

messageSchema.index({ chatId:          1  });
messageSchema.index({ senderId:        1  });
messageSchema.index({ 'readBy.userId': 1  });
messageSchema.index({ chatId: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Message', messageSchema);