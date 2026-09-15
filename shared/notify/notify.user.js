const logger = require('#shared/logger/logger');
const { createNotification } = require('#core/notification/notification.service');
const notificationPush = require('#core/notification/notification.push');

const persistNotification = (notificationData, recipient) =>
  createNotification({
    ...notificationData,
    recipient,
    time: new Date(),
  });

const notifyUser = async (recipient, notificationData) => {
  const notification = await persistNotification(notificationData, recipient);

  return notificationPush.dispatchNotificationToUser(recipient, {
    ...notificationData,
    notificationId: notification.data._id.toString(),
  });
};

const notifyUsers = async (recipients, notificationData) => {
  const notification = await persistNotification(notificationData);

  return notificationPush.dispatchNotificationToUsers(recipients, {
    ...notificationData,
    notificationId: notification.data._id.toString(),
  });
};

const broadcastNotification = async (notificationData) => {
  const notification = await persistNotification(notificationData);

  return notificationPush.dispatchBroadcastNotification({
    ...notificationData,
    notificationId: notification.data._id.toString(),
  });
};

const notifySafely = async (recipient, notificationData) => {
  try {
    return recipient
      ? await notifyUser(recipient, notificationData)
      : await broadcastNotification(notificationData);
  } catch (err) {
    logger.error('[Notify] failed:', err.message);
    return null;
  }
};

module.exports = {
  notifyUser,
  notifyUsers,
  broadcastNotification,
  notifySafely,
};
