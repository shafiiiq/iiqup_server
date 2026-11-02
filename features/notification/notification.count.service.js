const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { buildUnreadQuery } = require('./notification.query.builder');
const { countUnseenDocuments } = require('#core/document/document.view.service');

const countUnreadNotifications = (uniqueCode) => Notification.countDocuments(buildUnreadQuery(uniqueCode));

const countUnreadMentions = async (uniqueCode) => {
  const [unreadReplyMentions, unreadNotificationMentions] = await Promise.all([
    NotificationReply.countDocuments({ mentions: uniqueCode, 'viewedBy.uniqueCode': { $ne: uniqueCode } }),
    Notification.countDocuments({ ...buildUnreadQuery(uniqueCode), mentions: uniqueCode }),
  ]);
  return unreadReplyMentions + unreadNotificationMentions;
};

const countUnreadReplies = async (uniqueCode) => {
  const visibleNotificationIds = await Notification.distinct('_id', { audience: uniqueCode });
  if (visibleNotificationIds.length === 0) return 0;
  return NotificationReply.countDocuments({
    notificationId: { $in: visibleNotificationIds },
    'author.uniqueCode': { $ne: uniqueCode },
    mentions: { $ne: uniqueCode },
    'viewedBy.uniqueCode': { $ne: uniqueCode },
  });
};

const countUnreadByCategory = async (uniqueCode) => {
  const groups = await Notification.aggregate([
    { $match: { ...buildUnreadQuery(uniqueCode), categoryKey: { $ne: null } } },
    { $group: { _id: '$categoryKey', count: { $sum: 1 } } },
  ]);
  return new Map(groups.map((group) => [group._id, group.count]));
};

const getNotificationCounts = async (uniqueCode) => {
  const [unread, mentionsUnread, repliesUnread, unseenDocuments] = await Promise.all([
    countUnreadNotifications(uniqueCode),
    countUnreadMentions(uniqueCode),
    countUnreadReplies(uniqueCode),
    countUnseenDocuments(uniqueCode),
  ]);
  return {
    unread,
    mentionsUnread,
    repliesUnread,
    documentsUnseen: unseenDocuments.total,
    total: unread + mentionsUnread + repliesUnread + unseenDocuments.total,
  };
};

module.exports = {
  countUnreadNotifications,
  countUnreadMentions,
  countUnreadReplies,
  countUnreadByCategory,
  getNotificationCounts,
};