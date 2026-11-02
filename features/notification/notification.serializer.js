const { buildSourceKey } = require('./notification.attachment.resolver');

const hasReadReceipt = (notification, uniqueCode) =>
  (notification.readBy || []).some((receipt) => receipt.uniqueCode === uniqueCode);

const serializeNotification = (
  notification,
  uniqueCode,
  attachmentsBySource = new Map(),
  unseenReplyCounts = new Map(),
  categoryLabels = new Map()
) => {
  const isRecipient = (notification.recipients || []).includes(uniqueCode);

  return {
    _id: String(notification._id),
    kind: notification.kind,
    title: notification.title,
    body: notification.body || '',
    priority: notification.priority,
    actor: notification.actor || null,
    source: notification.source || null,
    actions: notification.actions || [],
    mentions: notification.mentions || [],
    mentionsMe: (notification.mentions || []).includes(uniqueCode),
    likeCount: (notification.likes || []).length,
    likedByMe: (notification.likes || []).some((like) => like.uniqueCode === uniqueCode),
    replyCount: notification.replyCount || 0,
    unseenReplyCount: unseenReplyCounts.get(String(notification._id)) || 0,
    categoryKey: notification.categoryKey || null,
    categoryLabel: notification.categoryKey ? categoryLabels.get(notification.categoryKey) || notification.categoryKey : null,
    featureLinks: notification.featureLinks || [],
    isRead: !isRecipient || hasReadReceipt(notification, uniqueCode),
    createdAt: notification.createdAt,
    lastActivityAt: notification.lastActivityAt || notification.createdAt,
    sourceAttachments: [
      ...(notification.source ? attachmentsBySource.get(buildSourceKey(notification.source)) || [] : []),
      ...(notification.attachments || []),
    ],
  };
};

const serializeReply = (reply, uniqueCode) => ({
  _id: String(reply._id),
  notificationId: String(reply.notificationId),
  author: reply.author,
  text: reply.text,
  mentions: reply.mentions || [],
  mentionsMe: (reply.mentions || []).includes(uniqueCode),
  isViewedByMe: (reply.viewedBy || []).some((receipt) => receipt.uniqueCode === uniqueCode),
  attachments: reply.attachments || [],
  featureLinks: reply.featureLinks || [],
  parentReplyId: reply.parentReplyId ? String(reply.parentReplyId) : null,
  likeCount: (reply.likes || []).length,
  likedByMe: (reply.likes || []).some((like) => like.uniqueCode === uniqueCode),
  createdAt: reply.createdAt,
});

const serializeQueuedDelivery = (delivery, actorAvatarUrl) => ({
  kind: 'notification',
  notificationId: String(delivery.notificationId),
  pushId: delivery.pushId,
  sequence: delivery.sequence,
  title: delivery.title,
  body: delivery.body || '',
  priority: delivery.priority,
  actorName: delivery.actor?.name || '',
  actorUniqueCode: delivery.actor?.uniqueCode || '',
  primaryAction: delivery.primaryAction
    ? {
        modelKey: delivery.primaryAction.modelKey,
        documentId: delivery.primaryAction.documentId,
        screenKey: delivery.primaryAction.screenKey,
      }
    : null,
  actorAvatarUrl: actorAvatarUrl || null,
  createdAt: delivery.createdAt,
});

module.exports = { serializeNotification, serializeReply, serializeQueuedDelivery };