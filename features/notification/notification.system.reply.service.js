const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { recordNotificationActivity } = require('./notification.activity.service');

const postSystemReply = async ({
  notificationId,
  actorUniqueCode,
  text,
  notifyCodes,
  pushBody,
  featureLinks = [],
  attachments = [],
}) => {
  const author = await resolveActorByUniqueCode(actorUniqueCode);
  if (!author) return null;

  const reply = await NotificationReply.create({
    notificationId,
    author,
    text,
    mentions: [],
    attachments,
    featureLinks,
    parentReplyId: null,
    viewedBy: [{ uniqueCode: actorUniqueCode }],
  });
  await Notification.updateOne({ _id: notificationId }, { $inc: { replyCount: 1 } });

  await recordNotificationActivity({
    notificationId,
    actorUniqueCode,
    notifyCodes,
    title: `${author.name} ${text}`,
    body: pushBody,
    activityType: 'reply',
    replyId: reply._id,
  });
  return reply.toObject();
};

module.exports = { postSystemReply };