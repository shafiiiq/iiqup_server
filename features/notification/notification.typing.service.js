const mongoose = require('mongoose');
const Notification = require('./notification.model');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { dispatchNotificationTypingToUser } = require('#core/notification/push/push.dispatcher');

const FALLBACK_TYPIST_NAME = 'Someone';

const broadcastNotificationTyping = async ({ notificationId, uniqueCode, isTyping }) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return;

  const notification = await Notification.findOne({ _id: notificationId, audience: uniqueCode })
    .select('audience')
    .lean();
  if (!notification) return;

  const typist = await resolveActorByUniqueCode(uniqueCode);
  notification.audience
    .filter((audienceCode) => audienceCode !== uniqueCode)
    .forEach((audienceCode) =>
      dispatchNotificationTypingToUser(audienceCode, {
        kind: 'notification_typing',
        notificationId: String(notificationId),
        uniqueCode,
        name: typist?.name || FALLBACK_TYPIST_NAME,
        isTyping,
      })
    );
};

module.exports = { broadcastNotificationTyping };