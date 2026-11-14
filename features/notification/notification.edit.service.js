const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { broadcastNotificationActivity } = require('./notification.activity.service');
const { updateQueuedDeliveryBody } = require('./notification.delivery.cancel.service');
const { ACTIVE_STATE, buildOwnedNotificationFilter, buildOwnedReplyFilter } = require('./notification.ownership');
const { MAX_REPLY_TEXT_LENGTH } = require('./notification.constant');

const normalizeEditedText = (text) => {
  const trimmedText = String(text || '').trim();
  if (trimmedText.length > MAX_REPLY_TEXT_LENGTH) throw new AppError('Message is too long', HTTP.BAD_REQUEST);
  return trimmedText;
};

const editNotificationText = async ({ notificationId, uniqueCode, text }) => {
  const trimmedText = normalizeEditedText(text);
  const filter = buildOwnedNotificationFilter({ notificationId, uniqueCode, state: ACTIVE_STATE });
  const notification = await Notification.findOne(filter).select('attachments featureLinks').lean();
  if (!notification) throw new AppError('Message not found', HTTP.NOT_FOUND);

  const hasOtherContent = (notification.attachments || []).length > 0 || (notification.featureLinks || []).length > 0;
  if (!trimmedText && !hasOtherContent) throw new AppError('Message cannot be empty', HTTP.BAD_REQUEST);

  const editedAt = new Date();
  await Notification.updateOne({ _id: notificationId }, { $set: { body: trimmedText, editedAt } });
  await updateQueuedDeliveryBody({ notificationId, body: trimmedText });
  await broadcastNotificationActivity({ notificationId, activityType: 'edited' });
  return { body: trimmedText, editedAt };
};

const editReplyText = async ({ replyId, uniqueCode, text }) => {
  const trimmedText = normalizeEditedText(text);
  const filter = buildOwnedReplyFilter({ replyId, uniqueCode, state: ACTIVE_STATE });
  const reply = await NotificationReply.findOne(filter).select('notificationId attachments featureLinks').lean();
  if (!reply) throw new AppError('Reply not found', HTTP.NOT_FOUND);

  const hasOtherContent = (reply.attachments || []).length > 0 || (reply.featureLinks || []).length > 0;
  if (!trimmedText && !hasOtherContent) throw new AppError('Reply cannot be empty', HTTP.BAD_REQUEST);

  const editedAt = new Date();
  await NotificationReply.updateOne({ _id: replyId }, { $set: { text: trimmedText, editedAt } });
  await updateQueuedDeliveryBody({ notificationId: reply.notificationId, replyId, body: trimmedText });
  await broadcastNotificationActivity({
    notificationId: reply.notificationId,
    activityType: 'reply_edited',
    replyId,
  });
  return { text: trimmedText, editedAt };
};

module.exports = { editNotificationText, editReplyText };