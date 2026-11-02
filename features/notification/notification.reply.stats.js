const NotificationReply = require('./notification.reply.model');

const countUnseenRepliesByNotification = async (notificationIds, uniqueCode) => {
  if (notificationIds.length === 0) return new Map();

  const groups = await NotificationReply.aggregate([
    {
      $match: {
        notificationId: { $in: notificationIds },
        'author.uniqueCode': { $ne: uniqueCode },
        'viewedBy.uniqueCode': { $ne: uniqueCode },
      },
    },
    { $group: { _id: '$notificationId', count: { $sum: 1 } } },
  ]);

  return new Map(groups.map((group) => [String(group._id), group.count]));
};

const getReplySummary = async (notificationId, uniqueCode) => {
  const [total, unseen] = await Promise.all([
    NotificationReply.countDocuments({ notificationId }),
    NotificationReply.countDocuments({
      notificationId,
      'author.uniqueCode': { $ne: uniqueCode },
      'viewedBy.uniqueCode': { $ne: uniqueCode },
    }),
  ]);
  return { total, unseen };
};

module.exports = { countUnseenRepliesByNotification, getReplySummary };