const Notification = require('./notification.model');
const { findVisibleNotification } = require('./notification.access');
const { buildUnreadQuery } = require('./notification.query.builder');
const { resolveActorsByUniqueCodes } = require('./notification.actor.resolver');

const markNotificationRead = async ({ notificationId, uniqueCode }) => {
  await findVisibleNotification(notificationId, uniqueCode, '_id');
  await Notification.updateOne(
    { _id: notificationId, recipients: uniqueCode, 'readBy.uniqueCode': { $ne: uniqueCode } },
    { $push: { readBy: { uniqueCode, readAt: new Date() } } }
  );
};

const markAllNotificationsRead = async ({ uniqueCode }) => {
  await Notification.updateMany(buildUnreadQuery(uniqueCode), {
    $push: { readBy: { uniqueCode, readAt: new Date() } },
  });
};

const listNotificationViewers = async ({ notificationId, uniqueCode }) => {
  const notification = await findVisibleNotification(notificationId, uniqueCode, 'readBy');
  const readTimeByCode = new Map(notification.readBy.map((receipt) => [receipt.uniqueCode, receipt.readAt]));
  const actors = await resolveActorsByUniqueCodes([...readTimeByCode.keys()]);
  return actors.map((actor) => ({ ...actor, readAt: readTimeByCode.get(actor.uniqueCode) }));
};

module.exports = { markNotificationRead, markAllNotificationsRead, listNotificationViewers };