const mongoose = require('mongoose');
const { USER_TYPES } = require('../shared/chat.constant');
const { MESSAGE_TYPES, MESSAGE_STATUSES } = require('./message.constant');

const readReceiptSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, required: true }, readAt: { type: Date, default: Date.now } },
  { _id: false }
);

const deliveryReceiptSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, required: true }, deliveredAt: { type: Date, default: Date.now } },
  { _id: false }
);

const replyToSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId },
    messageType: { type: String },
    content: { type: String },
    senderName: { type: String },
  },
  { _id: false }
);

const callDataSchema = new mongoose.Schema(
  {
    receiverId: { type: mongoose.Schema.Types.ObjectId },
    callType: { type: String },
    status: { type: String },
    duration: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },

    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: USER_TYPES, required: true },
    senderName: { type: String, required: true },

    messageType: { type: String, enum: MESSAGE_TYPES, default: 'text', required: true },
    content: { type: String, required: true },
    caption: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    duration: { type: Number },
    editedAt: { type: Date },

    status: { type: String, enum: MESSAGE_STATUSES, default: 'sent' },
    readBy: { type: [readReceiptSchema], default: [] },
    deliveredTo: { type: [deliveryReceiptSchema], default: [] },

    replyTo: { type: replyToSchema },
    callData: { type: callDataSchema },

    isDeleted: { type: Boolean, default: false },
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);