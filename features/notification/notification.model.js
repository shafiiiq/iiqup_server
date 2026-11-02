const mongoose = require('mongoose');
const { NOTIFICATION_KINDS, NOTIFICATION_PRIORITIES, DEFAULT_PRIORITY } = require('./notification.constant');
const { featureLinkSchema } = require('./notification.feature.schema');
const { actorSchema, readReceiptSchema, likeSchema, attachmentSchema } = require('./notification.schema.parts');

const sourceSchema = new mongoose.Schema(
  {
    modelKey: { type: String, required: true },
    documentId: { type: String, required: true },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    modelKey: { type: String, required: true },
    documentId: { type: String, required: true },
    screenKey: { type: String, required: true },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: Object.values(NOTIFICATION_KINDS), default: NOTIFICATION_KINDS.EVENT },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: DEFAULT_PRIORITY },
    actor: { type: actorSchema, default: null },
    source: { type: sourceSchema, default: null },
    actions: { type: [actionSchema], default: [] },
    categoryKey: { type: String, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    featureLinks: { type: [featureLinkSchema], default: [] },
    audience: { type: [String], default: [] },
    recipients: { type: [String], default: [] },
    mentions: { type: [String], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
    likes: { type: [likeSchema], default: [] },
    replyCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, lastActivityAt: -1, _id: -1 });
notificationSchema.index({ audience: 1, categoryKey: 1, lastActivityAt: -1, _id: -1 });
notificationSchema.index({ recipients: 1 });
notificationSchema.index({ mentions: 1, lastActivityAt: -1, _id: -1 });
notificationSchema.index({ 'source.modelKey': 1, 'source.documentId': 1 });

module.exports = mongoose.model('Notifications', notificationSchema);