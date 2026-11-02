const logger = require('#shared/logger/logger');
const notificationEvents = require('../events/notification.events');
const { dispatchNotificationPush, dispatchTypingPush, dispatchDismissPush } = require('./push.fcm');
const { dispatchVoipCallNotification } = require('./push.call');
const { dispatchNotificationWebPush } = require('./push.web');

const getSocketGateway = () => require('#core/socket/socket.io');

const wrapWebSocketDispatch = (dispatchFunction) => {
  try {
    dispatchFunction();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const dispatchNotificationToUser = async (uniqueCode, payload, { shouldPush = true } = {}) => {
  const websocket = wrapWebSocketDispatch(() =>
    getSocketGateway().dispatchUserWebSocketNotification(uniqueCode, payload)
  );
  const [pushNotification, webPushNotification] = await Promise.all([
    shouldPush
      ? dispatchNotificationPush(uniqueCode, payload).catch((error) => ({
          success: false,
          message: error.message,
        }))
      : { success: true, skipped: true },
    dispatchNotificationWebPush(uniqueCode, payload),
  ]);
  return { uniqueCode, websocket, pushNotification, webPushNotification };
};

const dispatchUnreadCountToUser = (uniqueCode, counts) =>
  wrapWebSocketDispatch(() =>
    getSocketGateway().dispatchUserWebSocketEvent(uniqueCode, 'notification_counts', {
      kind: 'notification_counts',
      unreadCount: counts.unread,
      mentionsUnread: counts.mentionsUnread,
      repliesUnread: counts.repliesUnread,
    })
  );

const dispatchNotificationActivityToUser = (uniqueCode, payload) =>
  wrapWebSocketDispatch(() =>
    getSocketGateway().dispatchUserWebSocketEvent(uniqueCode, 'notification_activity', payload)
  );

notificationEvents.on('dismiss-notification', ({ uniqueCode, notificationId }) => {
  dispatchDismissPush(uniqueCode, notificationId).catch((error) =>
    logger.error('[push.dispatcher] dismiss-notification', error)
  );
});

notificationEvents.on('typing-push-notification', (typingPayload) => {
  dispatchTypingPush(typingPayload.uniqueCode, typingPayload).catch((error) =>
    logger.error('[push.dispatcher] typing-push-notification', error)
  );
});

notificationEvents.on('voip-call-notification', ({ uniqueCode, callerName, callerId, chatId }) => {
  dispatchVoipCallNotification(uniqueCode, callerName, callerId, chatId).catch((error) =>
    logger.error('[push.dispatcher] voip-call-notification', error)
  );
});

const dispatchNotificationTypingToUser = (uniqueCode, payload) =>
  wrapWebSocketDispatch(() => getSocketGateway().dispatchUserWebSocketEvent(uniqueCode, 'notification_typing', payload));

module.exports = {
  dispatchNotificationToUser,
  dispatchUnreadCountToUser,
  dispatchNotificationActivityToUser,
  dispatchNotificationTypingToUser,
};