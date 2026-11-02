const logger = require('#shared/logger/logger');
const { dispatchNotificationPush } = require('#core/notification/push/push.fcm');
const { getNotificationCounts } = require('./notification.count.service');
const { claimDueWakeRetries } = require('./notification.delivery.queue.service');

const buildWakePayload = (delivery, counts) => ({
  kind: 'notification',
  notificationId: String(delivery.notificationId),
  pushId: delivery.pushId,
  sequence: delivery.sequence,
  title: delivery.title,
  body: delivery.body,
  priority: delivery.priority,
  unreadCount: counts.unread,
  totalUnread: counts.total,
  mentionsUnread: counts.mentionsUnread,
  repliesUnread: counts.repliesUnread,
  actor: delivery.actor,
  primaryAction: delivery.primaryAction,
  actorAvatarUrl: null,
});

const sendWakeRetry = async (delivery) => {
  try {
    const counts = await getNotificationCounts(delivery.uniqueCode);
    const result = await dispatchNotificationPush(delivery.uniqueCode, buildWakePayload(delivery, counts));
    logger.info(
      `[notification.delivery.wake] retry ${delivery.wakeRetryCount} for ${delivery.uniqueCode} sequence ${delivery.sequence} success=${result.success}`
    );
  } catch (error) {
    logger.error(`[notification.delivery.wake] retry failed for ${delivery.uniqueCode}: ${error.message}`);
  }
};

const sendDueWakeRetries = async () => {
  const deliveries = await claimDueWakeRetries();
  await Promise.all(deliveries.map(sendWakeRetry));
};

module.exports = { sendDueWakeRetries };