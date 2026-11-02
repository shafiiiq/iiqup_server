const { buildApnsHeaders, dispatchMessageToUser } = require('./push.fcm');

const buildCallMessage = ({ callerName, callerId, chatId }) => {
  const title = `Incoming call from ${callerName}`;
  const body = 'Tap to answer';
  const notificationId = `call_${callerId}_${Date.now()}`;

  return {
    data: {
      type: 'call',
      callAction: 'incoming',
      callerId: String(callerId),
      callerName: String(callerName),
      chatId: String(chatId),
      notificationId,
    },
    notification: { title, body },
    android: {
      priority: 'high',
      notification: { channelId: 'call_channel', sound: 'call_ringtone', priority: 'max', visibility: 'public' },
    },
    apns: {
      headers: buildApnsHeaders(notificationId),
      payload: { aps: { alert: { title, body }, sound: 'default', 'content-available': 1, category: 'CALL_INVITATION' } },
    },
  };
};

const dispatchVoipCallNotification = (uniqueCode, callerName, callerId, chatId) =>
  dispatchMessageToUser(uniqueCode, buildCallMessage({ callerName, callerId, chatId }));

module.exports = { dispatchVoipCallNotification };