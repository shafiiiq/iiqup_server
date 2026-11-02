const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { searchActorsByName } = require('./notification.actor.resolver');
const { buildUnreadQuery } = require('./notification.query.builder');
const { MENTION_SEARCH_LIMIT, MENTION_TARGET_LIMIT } = require('./notification.constant');

const searchMentionableActors = async ({ term, uniqueCode }) => {
  const trimmedTerm = String(term || '').trim();
  if (!trimmedTerm) return [];
  return searchActorsByName({ term: trimmedTerm, excludeUniqueCode: uniqueCode, limit: MENTION_SEARCH_LIMIT });
};

const listUnreadMentionTargets = async (uniqueCode) => {
  const [replies, notifications] = await Promise.all([
    NotificationReply.find({ mentions: uniqueCode, 'viewedBy.uniqueCode': { $ne: uniqueCode } })
      .select('notificationId createdAt')
      .sort({ createdAt: -1 })
      .limit(MENTION_TARGET_LIMIT)
      .lean(),
    Notification.find({ ...buildUnreadQuery(uniqueCode), mentions: uniqueCode })
      .select('createdAt')
      .sort({ createdAt: -1 })
      .limit(MENTION_TARGET_LIMIT)
      .lean(),
  ]);

  const replyTargets = replies.map((reply) => ({
    notificationId: String(reply.notificationId),
    replyId: String(reply._id),
    createdAt: reply.createdAt,
  }));
  const notificationTargets = notifications.map((notification) => ({
    notificationId: String(notification._id),
    replyId: null,
    createdAt: notification.createdAt,
  }));

  return [...replyTargets, ...notificationTargets].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt)
  );
};

module.exports = { searchMentionableActors, listUnreadMentionTargets };