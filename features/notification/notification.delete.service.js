const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { broadcastNotificationActivity } = require('./notification.activity.service');
const { syncNotificationCounts } = require('./notification.dispatcher');
const {
  cancelDeliveries,
  reinstateDeliveries,
} = require('./notification.delivery.cancel.service');
const {
  ACTIVE_STATE,
  buildRestorableState,
  buildOwnedNotificationFilter,
  buildOwnedReplyFilter,
} = require('./notification.ownership');

const syncAudienceCounts = async (notificationId) => {
  const notification = await Notification.findById(notificationId).select('audience').lean();
  await Promise.allSettled((notification?.audience || []).map((uniqueCode) => syncNotificationCounts(uniqueCode)));
};

const deleteNotification = async ({ notificationId, uniqueCode }) => {
  const filter = buildOwnedNotificationFilter({ notificationId, uniqueCode, state: ACTIVE_STATE });
  const deletedAt = new Date();
  const result = await Notification.updateOne(filter, { $set: { deletedAt } });
  if (result.matchedCount === 0) throw new AppError('Message not found', HTTP.NOT_FOUND);

  await cancelDeliveries({ notificationId });
  await broadcastNotificationActivity({ notificationId, activityType: 'deleted' });
  await syncAudienceCounts(notificationId);
  return { deletedAt };
};

const restoreNotification = async ({ notificationId, uniqueCode }) => {
  const filter = buildOwnedNotificationFilter({ notificationId, uniqueCode, state: buildRestorableState() });
  const result = await Notification.updateOne(filter, { $set: { deletedAt: null } });
  if (result.matchedCount === 0) throw new AppError('Undo window has expired', HTTP.NOT_FOUND);

  await reinstateDeliveries({ notificationId });
  await broadcastNotificationActivity({ notificationId, activityType: 'restored' });
  await syncAudienceCounts(notificationId);
  return { restored: true };
};

const deleteReply = async ({ replyId, uniqueCode }) => {
  const filter = buildOwnedReplyFilter({ replyId, uniqueCode, state: ACTIVE_STATE });
  const deletedAt = new Date();
  const reply = await NotificationReply.findOneAndUpdate(filter, { $set: { deletedAt } })
    .select('notificationId')
    .lean();
  if (!reply) throw new AppError('Reply not found', HTTP.NOT_FOUND);

  await Notification.updateOne({ _id: reply.notificationId }, { $inc: { replyCount: -1 } });
  await cancelDeliveries({ notificationId: reply.notificationId, replyId });
  await broadcastNotificationActivity({
    notificationId: reply.notificationId,
    activityType: 'reply_deleted',
    replyId,
  });
  await syncAudienceCounts(reply.notificationId);
  return { deletedAt };
};

const restoreReply = async ({ replyId, uniqueCode }) => {
  const filter = buildOwnedReplyFilter({ replyId, uniqueCode, state: buildRestorableState() });
  const reply = await NotificationReply.findOneAndUpdate(filter, { $set: { deletedAt: null } })
    .select('notificationId')
    .lean();
  if (!reply) throw new AppError('Undo window has expired', HTTP.NOT_FOUND);

  await Notification.updateOne({ _id: reply.notificationId }, { $inc: { replyCount: 1 } });
  await reinstateDeliveries({ notificationId: reply.notificationId, replyId });
  await broadcastNotificationActivity({
    notificationId: reply.notificationId,
    activityType: 'reply_restored',
    replyId,
  });
  await syncAudienceCounts(reply.notificationId);
  return { restored: true };
};

module.exports = { deleteNotification, restoreNotification, deleteReply, restoreReply };