const mongoose = require('mongoose');
const { USER_TYPES, CHAT_TYPES } = require('./chat.constant');

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, enum: USER_TYPES, required: true },
    uniqueCode: { type: String, required: true },
    name: { type: String },
    isAdmin: { type: Boolean, default: false },
  },
  { _id: false }
);

const lastMessageSenderSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId }, name: { type: String } },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(CHAT_TYPES), required: true },
    name: { type: String },
    creatorId: { type: mongoose.Schema.Types.ObjectId },
    participants: { type: [participantSchema], default: [] },

    lastMessage: { type: String, default: '' },
    lastMessageType: { type: String, default: 'text' },
    lastMessageTime: { type: Date, default: Date.now },
    lastMessageSender: { type: lastMessageSenderSchema },

    unreadCount: { type: Map, of: Number, default: {} },
    hiddenFor: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    favoriteFor: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

chatSchema.index({ 'participants.userId': 1, lastMessageTime: -1 });
chatSchema.index({ 'participants.uniqueCode': 1 });

module.exports = mongoose.model('Chat', chatSchema);