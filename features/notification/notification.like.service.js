const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { assertValidObjectId, findVisibleNotification } = require('./notification.access');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { recordNotificationActivity, broadcastNotificationActivity } = require('./notification.activity.service');

const FALLBACK_LIKER_NAME = 'Someone';

const summarizeLikes = (document, uniqueCode) => ({
  likeCount: document.likes.length,
  likedByMe: document.likes.some((like) => like.uniqueCode === uniqueCode),
});

const applyLike = async (Model, filter, uniqueCode, isLiked) => {
  const update = isLiked
    ? { filter: { ...filter, 'likes.uniqueCode': { $ne: uniqueCode } }, change: { $push: { likes: { uniqueCode, likedAt: new Date() } } } }
    : { filter: { ...filter, 'likes.uniqueCode': uniqueCode }, change: { $pull: { likes: { uniqueCode } } } };

  const updated = await Model.findOneAndUpdate(update.filter, update.change, { new: true }).select('likes').lean();
  if (updated) return { document: updated, changed: true };

  const current = await Model.findOne(filter).select('likes').lean();
  if (!current) throw new AppError('Not found', HTTP.NOT_FOUND);
  return { document: current, changed: false };
};

const resolveLikerName = async (uniqueCode) => (await resolveActorByUniqueCode(uniqueCode))?.name || FALLBACK_LIKER_NAME;

const setNotificationLike = async ({ notificationId, uniqueCode, isLiked }) => {
  const notification = await findVisibleNotification(notificationId, uniqueCode, 'actor');
  const { document, changed } = await applyLike(Notification, { _id: notificationId }, uniqueCode, isLiked);

  if (changed && isLiked) {
    await recordNotificationActivity({
      notificationId,
      actorUniqueCode: uniqueCode,
      notifyCodes: [notification.actor?.uniqueCode],
      title: `${await resolveLikerName(uniqueCode)} liked this notification`,
      activityType: 'like',
    });
  }
  if (changed && !isLiked) await broadcastNotificationActivity({ notificationId, activityType: 'like' });

  return summarizeLikes(document, uniqueCode);
};

const setReplyLike = async ({ replyId, uniqueCode, isLiked }) => {
  assertValidObjectId(replyId, 'reply id');
  const reply = await NotificationReply.findById(replyId).select('notificationId author text').lean();
  if (!reply) throw new AppError('Reply not found', HTTP.NOT_FOUND);

  await findVisibleNotification(reply.notificationId, uniqueCode, '_id');
  const { document, changed } = await applyLike(NotificationReply, { _id: replyId }, uniqueCode, isLiked);

  if (changed && isLiked) {
    await recordNotificationActivity({
      notificationId: reply.notificationId,
      actorUniqueCode: uniqueCode,
      notifyCodes: [reply.author.uniqueCode],
      title: `${await resolveLikerName(uniqueCode)} liked your reply`,
      body: reply.text,
      activityType: 'reply_like',
      replyId: reply._id,
    });
  }
  if (changed && !isLiked) {
    await broadcastNotificationActivity({
      notificationId: reply.notificationId,
      activityType: 'reply_like',
      replyId: reply._id,
    });
  }

  return summarizeLikes(document, uniqueCode);
};

module.exports = { setNotificationLike, setReplyLike };