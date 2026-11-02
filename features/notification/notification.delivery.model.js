const mongoose = require('mongoose');
const {
  NOTIFICATION_PRIORITIES,
  DEFAULT_PRIORITY,
  NOTIFICATION_DELIVERY_STATUSES,
  DELIVERY_RETENTION_SECONDS,
} = require('./notification.constant');

const deliveryActorSchema = new mongoose.Schema(
  {
    uniqueCode: { type: String, default: '' },
    name: { type: String, default: '' },
    profilePicPath: { type: String, default: '' },
  },
  { _id: false }
);

const deliveryPrimaryActionSchema = new mongoose.Schema(
  {
    modelKey: { type: String, required: true },
    documentId: { type: String, required: true },
    screenKey: { type: String, required: true },
  },
  { _id: false }
);

const notificationDeliverySchema = new mongoose.Schema(
  {
    uniqueCode: { type: String, required: true },
    sequence: { type: Number, required: true },
    pushId: { type: String, required: true, unique: true },
    notificationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: DEFAULT_PRIORITY },
    actor: { type: deliveryActorSchema, default: null },
    primaryAction: { type: deliveryPrimaryActionSchema, default: null },
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_DELIVERY_STATUSES),
      default: NOTIFICATION_DELIVERY_STATUSES.QUEUED,
    },
    deliveredAt: { type: Date, default: null },
    wakeRetryCount: { type: Number, default: 0 },
    lastWakeRetryAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ uniqueCode: 1, sequence: 1 }, { unique: true });
notificationDeliverySchema.index({ uniqueCode: 1, status: 1, sequence: 1 });
notificationDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: DELIVERY_RETENTION_SECONDS });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);