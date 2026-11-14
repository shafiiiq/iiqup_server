const { assertValidObjectId } = require('./notification.access');
const { NOTIFICATION_UNDO_WINDOW_MS } = require('./notification.constant');

const ACTIVE_STATE = { deletedAt: null };

const buildRestorableState = () => ({
  deletedAt: { $gte: new Date(Date.now() - NOTIFICATION_UNDO_WINDOW_MS) },
});

const buildOwnedNotificationFilter = ({ notificationId, uniqueCode, state }) => {
  assertValidObjectId(notificationId, 'notification id');
  return { _id: notificationId, 'actor.uniqueCode': uniqueCode, source: null, ...state };
};

const buildOwnedReplyFilter = ({ replyId, uniqueCode, state }) => {
  assertValidObjectId(replyId, 'reply id');
  return { _id: replyId, 'author.uniqueCode': uniqueCode, ...state };
};

module.exports = { ACTIVE_STATE, buildRestorableState, buildOwnedNotificationFilter, buildOwnedReplyFilter };