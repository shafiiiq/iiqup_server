const logger = require('#shared/logger/logger');
const Notification = require('./notification.model');
const { toUniqueCodes } = require('./notification.create.service');
const { pushNotificationActivity } = require('./notification.dispatcher');
const { dispatchNotificationActivityToUser } = require('#core/notification/push/push.dispatcher');

const broadcastNotificationActivity = async ({ notificationId, activityType, replyId = null, audience = null }) => {
  try {
    const resolvedAudience =
      audience || (await Notification.findById(notificationId).select('audience').lean())?.audience || [];

    resolvedAudience.forEach((uniqueCode) =>
      dispatchNotificationActivityToUser(uniqueCode, {
        kind: 'notification_activity',
        notificationId: String(notificationId),
        activityType,
        replyId: replyId ? String(replyId) : null,
      })
    );
  } catch (error) {
    logger.error(`[notification.activity] broadcastNotificationActivity failed: ${error.stack || error.message}`);
  }
};

const recordNotificationActivity = async ({
  notificationId,
  actorUniqueCode,
  notifyCodes = [],
  title,
  body = '',
  activityType,
  replyId = null,
}) => {
  try {
    const codesToNotify = toUniqueCodes(notifyCodes).filter((uniqueCode) => uniqueCode !== actorUniqueCode);

    const update = { $set: { lastActivityAt: new Date() } };
    if (codesToNotify.length > 0) {
      update.$addToSet = { audience: { $each: codesToNotify }, recipients: { $each: codesToNotify } };
      update.$pull = { readBy: { uniqueCode: { $in: codesToNotify } } };
    }

    const notification = await Notification.findByIdAndUpdate(notificationId, update, { new: true }).lean();
    if (!notification) return null;

    if (codesToNotify.length > 0) {
      await pushNotificationActivity(notification, codesToNotify, { title, body, actorUniqueCode });
    }
    await broadcastNotificationActivity({
      notificationId,
      activityType,
      replyId,
      audience: notification.audience,
    });
    return notification;
  } catch (error) {
    logger.error(`[notification.activity] recordNotificationActivity failed: ${error.stack || error.message}`);
    return null;
  }
};

module.exports = { recordNotificationActivity, broadcastNotificationActivity };