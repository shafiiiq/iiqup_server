const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const NotificationReply = require('./notification.reply.model');
const NotificationDelivery = require('./notification.delivery.model');
const { assertValidObjectId, findVisibleNotification } = require('./notification.access');
const { resolveActorsByUniqueCodes } = require('./notification.actor.resolver');
const { NOTIFICATION_DELIVERY_STATUSES } = require('./notification.constant');
const { buildReceiptEntries, toReceiptUser } = require('./notification.receipt.entries');

const PREVIEW_USER_LIMIT = 2;

const findDeliveredEntries = async (filter, keyField) => {
  const deliveries = await NotificationDelivery.find({
    ...filter,
    status: NOTIFICATION_DELIVERY_STATUSES.DELIVERED,
  })
    .select(`${keyField} uniqueCode deliveredAt`)
    .lean();
  const entriesByKey = new Map();
  deliveries.forEach((delivery) => {
    const key = String(delivery[keyField]);
    const entries = entriesByKey.get(key) || [];
    entries.push({ uniqueCode: delivery.uniqueCode, at: delivery.deliveredAt });
    entriesByKey.set(key, entries);
  });
  return entriesByKey;
};

const buildActorMap = async (uniqueCodes) => {
  const actors = await resolveActorsByUniqueCodes([...new Set(uniqueCodes)]);
  return new Map(actors.map((actor) => [actor.uniqueCode, actor]));
};

const buildReplyTarget = ({ reply, audience, deliveredEntries }) => ({
  key: String(reply._id),
  recipientCodes: audience.filter((uniqueCode) => uniqueCode !== reply.author.uniqueCode),
  deliveredEntries,
  readEntries: (reply.viewedBy || []).map((receipt) => ({ uniqueCode: receipt.uniqueCode, at: receipt.viewedAt })),
});

const summarizeTargets = async (targets) => {
  const resolvedTargets = targets.map((target) => ({ key: target.key, ...buildReceiptEntries(target) }));
  const actorByCode = await buildActorMap(
    resolvedTargets.flatMap((target) =>
      target.delivered.slice(0, PREVIEW_USER_LIMIT).map((entry) => entry.uniqueCode)
    )
  );
  return new Map(
    resolvedTargets.map((target) => [
      target.key,
      {
        recipientCount: target.recipientCount,
        deliveredCount: target.delivered.length,
        readCount: target.read.length,
        isEveryoneRead: target.recipientCount > 0 && target.read.length >= target.recipientCount,
        previewUsers: target.delivered
          .slice(0, PREVIEW_USER_LIMIT)
          .map((entry) => actorByCode.get(entry.uniqueCode))
          .filter(Boolean)
          .map((actor) => toReceiptUser(actor)),
      },
    ])
  );
};

const buildNotificationReceiptSummaries = async (notifications) => {
  if (notifications.length === 0) return new Map();
  const deliveredByKey = await findDeliveredEntries(
    { notificationId: { $in: notifications.map((notification) => notification._id) }, replyId: null },
    'notificationId'
  );
  return summarizeTargets(
    notifications.map((notification) => ({
      key: String(notification._id),
      recipientCodes: notification.recipients || [],
      deliveredEntries: deliveredByKey.get(String(notification._id)) || [],
      readEntries: (notification.readBy || []).map((receipt) => ({
        uniqueCode: receipt.uniqueCode,
        at: receipt.readAt,
      })),
    }))
  );
};

const buildReplyReceiptSummaries = async ({ replyIds, audience }) => {
  if (replyIds.length === 0) return new Map();
  const [replies, deliveredByKey] = await Promise.all([
    NotificationReply.find({ _id: { $in: replyIds } }).select('author viewedBy').lean(),
    findDeliveredEntries({ replyId: { $in: replyIds } }, 'replyId'),
  ]);
  return summarizeTargets(
    replies.map((reply) =>
      buildReplyTarget({ reply, audience, deliveredEntries: deliveredByKey.get(String(reply._id)) || [] })
    )
  );
};

const buildReceiptDetails = async (target) => {
  const entries = buildReceiptEntries(target);
  const actorByCode = await buildActorMap(
    [...entries.delivered, ...entries.read].map((entry) => entry.uniqueCode)
  );
  const toUsers = (list) =>
    list
      .filter((entry) => actorByCode.has(entry.uniqueCode))
      .map((entry) => toReceiptUser(actorByCode.get(entry.uniqueCode), entry.at));
  return {
    recipientCount: entries.recipientCount,
    delivered: toUsers(entries.delivered),
    read: toUsers(entries.read),
  };
};

const getNotificationReceiptDetails = async ({ notificationId, uniqueCode }) => {
  const notification = await findVisibleNotification(notificationId, uniqueCode, 'recipients readBy');
  const deliveredByKey = await findDeliveredEntries({ notificationId, replyId: null }, 'notificationId');
  return buildReceiptDetails({
    recipientCodes: notification.recipients || [],
    deliveredEntries: deliveredByKey.get(String(notificationId)) || [],
    readEntries: (notification.readBy || []).map((receipt) => ({ uniqueCode: receipt.uniqueCode, at: receipt.readAt })),
  });
};

const getReplyReceiptDetails = async ({ replyId, uniqueCode }) => {
  assertValidObjectId(replyId, 'reply id');
  const reply = await NotificationReply.findOne({ _id: replyId, deletedAt: null })
    .select('notificationId author viewedBy')
    .lean();
  if (!reply) throw new AppError('Reply not found', HTTP.NOT_FOUND);
  const notification = await findVisibleNotification(reply.notificationId, uniqueCode, 'audience');
  const deliveredByKey = await findDeliveredEntries({ replyId }, 'replyId');
  return buildReceiptDetails(
    buildReplyTarget({
      reply,
      audience: notification.audience || [],
      deliveredEntries: deliveredByKey.get(String(replyId)) || [],
    })
  );
};

module.exports = {
  buildNotificationReceiptSummaries,
  buildReplyReceiptSummaries,
  getNotificationReceiptDetails,
  getReplyReceiptDetails,
};