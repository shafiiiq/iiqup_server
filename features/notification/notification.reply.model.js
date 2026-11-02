const mongoose = require('mongoose');
const { actorSchema, likeSchema, viewReceiptSchema, attachmentSchema } = require('./notification.schema.parts');
const { featureLinkSchema } = require('./notification.feature.schema');

const notificationReplySchema = new mongoose.Schema(
  {
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notifications', required: true },
    author: { type: actorSchema, required: true },
    text: { type: String, default: '' },
    mentions: { type: [String], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    featureLinks: { type: [featureLinkSchema], default: [] },
    parentReplyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    likes: { type: [likeSchema], default: [] },
    viewedBy: { type: [viewReceiptSchema], default: [] },
  },
  { timestamps: true }
);

notificationReplySchema.index({ notificationId: 1, createdAt: 1, _id: 1 });

module.exports = mongoose.model('NotificationReply', notificationReplySchema);