const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const NotificationReply = require('./notification.reply.model');
const { NOTIFICATION_TABS } = require('./notification.constant');

const buildAudienceQuery = (uniqueCode) => ({ audience: uniqueCode, deletedAt: null });

const buildUnreadQuery = (uniqueCode) => ({
  recipients: uniqueCode,
  deletedAt: null,
  'readBy.uniqueCode': { $ne: uniqueCode },
});

const buildMentionsQuery = async (uniqueCode) => {
  const notificationIdsMentionedInReplies = await NotificationReply.distinct('notificationId', {
    mentions: uniqueCode,
    deletedAt: null,
  });
  return {
    audience: uniqueCode,
    deletedAt: null,
    $or: [{ mentions: uniqueCode }, { _id: { $in: notificationIdsMentionedInReplies } }],
  };
};

const buildTabQuery = async ({ uniqueCode, tab, categoryKey }) => {
  switch (tab) {
    case NOTIFICATION_TABS.ALL:
      return buildAudienceQuery(uniqueCode); 
    case NOTIFICATION_TABS.UNREAD:
      return buildUnreadQuery(uniqueCode);
    case NOTIFICATION_TABS.MENTIONS:
      return buildMentionsQuery(uniqueCode);
    case NOTIFICATION_TABS.CATEGORY:
      if (typeof categoryKey !== 'string' || !categoryKey) throw new AppError('categoryKey is required', HTTP.BAD_REQUEST);
      return { audience: uniqueCode, categoryKey, deletedAt: null };
    default:
      throw new AppError('Unknown tab', HTTP.BAD_REQUEST);
  }
};

module.exports = { buildAudienceQuery, buildUnreadQuery, buildTabQuery };