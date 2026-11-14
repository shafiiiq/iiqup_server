const notificationEvents = require('#core/notification/events/notification.events');
const NotificationDelivery = require('./notification.delivery.model');
const { NOTIFICATION_DELIVERY_STATUSES, PUSH_BODY_PREVIEW_LENGTH } = require('./notification.constant');

const buildDeliveryFilter = ({ notificationId, replyId }) => ({
  notificationId,
  ...(replyId ? { replyId } : {}),
});

const dismissPresentedDeliveries = (deliveries) => {
  const dismissKeys = new Set();
  deliveries.forEach((delivery) => {
    const dismissKey = `${delivery.uniqueCode}:${delivery.notificationId}`;
    if (dismissKeys.has(dismissKey)) return;
    dismissKeys.add(dismissKey);
    notificationEvents.emit('dismiss-notification', {
      uniqueCode: delivery.uniqueCode,
      notificationId: String(delivery.notificationId),
    });
  });
};

const cancelDeliveries = async ({ notificationId, replyId = null }) => {
  const filter = buildDeliveryFilter({ notificationId, replyId });
  const deliveries = await NotificationDelivery.find(filter).select('uniqueCode notificationId').lean();
  await NotificationDelivery.updateMany(
    { ...filter, status: NOTIFICATION_DELIVERY_STATUSES.QUEUED },
    { $set: { status: NOTIFICATION_DELIVERY_STATUSES.CANCELLED } }
  );
  dismissPresentedDeliveries(deliveries);
};

const reinstateDeliveries = async ({ notificationId, replyId = null }) => {
  await NotificationDelivery.updateMany(
    { ...buildDeliveryFilter({ notificationId, replyId }), status: NOTIFICATION_DELIVERY_STATUSES.CANCELLED },
    { $set: { status: NOTIFICATION_DELIVERY_STATUSES.QUEUED } }
  );
};

const updateQueuedDeliveryBody = async ({ notificationId, replyId = null, body }) => {
  await NotificationDelivery.updateMany(
    { notificationId, replyId, status: NOTIFICATION_DELIVERY_STATUSES.QUEUED },
    { $set: { body: String(body || '').slice(0, PUSH_BODY_PREVIEW_LENGTH) } }
  );
};

module.exports = { cancelDeliveries, reinstateDeliveries, updateQueuedDeliveryBody };