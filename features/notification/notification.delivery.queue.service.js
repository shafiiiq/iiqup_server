const { randomUUID } = require('crypto');
const NotificationDelivery = require('./notification.delivery.model');
const NotificationDeliverySequence = require('./notification.delivery.sequence.model');
const {
  NOTIFICATION_DELIVERY_STATUSES,
  WAKE_PUSH_SUPPRESS_WINDOW_MS,
  ACKNOWLEDGE_BATCH_LIMIT,
  PENDING_NOTIFICATION_LIMIT,
  PENDING_NOTIFICATION_WINDOW_MS,
  WAKE_RETRY_FAST_INTERVAL_MS,
  WAKE_RETRY_FAST_COUNT,
  WAKE_RETRY_SLOW_INTERVAL_MS,
  WAKE_RETRY_MAX_COUNT,
} = require('./notification.constant');

const DUPLICATE_KEY_ERROR_CODE = 11000;
const SEQUENCE_RESERVE_ATTEMPTS = 3;

const reserveNextSequence = async (uniqueCode) => {
  for (let attempt = 1; attempt <= SEQUENCE_RESERVE_ATTEMPTS; attempt += 1) {
    try {
      const counter = await NotificationDeliverySequence.findOneAndUpdate(
        { uniqueCode },
        { $inc: { value: 1 } },
        { upsert: true, new: true }
      ).lean();
      return counter.value;
    } catch (error) {
      if (error.code !== DUPLICATE_KEY_ERROR_CODE || attempt === SEQUENCE_RESERVE_ATTEMPTS) throw error;
    }
  }
  return null;
};

const enqueueDelivery = async ({ uniqueCode, payload }) => {
  const sequence = await reserveNextSequence(uniqueCode);
  const delivery = await NotificationDelivery.create({
    uniqueCode,
    sequence,
    pushId: randomUUID(),
    notificationId: payload.notificationId,
    title: payload.title,
    body: payload.body,
    priority: payload.priority,
    actor: payload.actor
      ? {
          uniqueCode: payload.actor.uniqueCode,
          name: payload.actor.name,
          profilePicPath: payload.actor.profilePicPath,
        }
      : null,
    primaryAction: payload.primaryAction,
  });
  return delivery.toObject();
};

const claimWakePush = async (uniqueCode) => {
  const now = new Date();
  const claimedCounter = await NotificationDeliverySequence.findOneAndUpdate(
    { uniqueCode, $or: [{ wakeLockUntil: null }, { wakeLockUntil: { $lt: now } }] },
    { $set: { wakeLockUntil: new Date(now.getTime() + WAKE_PUSH_SUPPRESS_WINDOW_MS) } }
  ).lean();
  return Boolean(claimedCounter);
};

const calculateWakeRetryDelayMs = (wakeRetryCount) =>
  wakeRetryCount < WAKE_RETRY_FAST_COUNT ? WAKE_RETRY_FAST_INTERVAL_MS : WAKE_RETRY_SLOW_INTERVAL_MS;

const isWakeRetryDue = (delivery, nowMs) => {
  const lastAttemptMs = new Date(delivery.lastWakeRetryAt || delivery.createdAt).getTime();
  return nowMs - lastAttemptMs >= calculateWakeRetryDelayMs(delivery.wakeRetryCount);
};

const findOldestQueuedDeliveryPerUser = () =>
  NotificationDelivery.aggregate([
    {
      $match: {
        status: NOTIFICATION_DELIVERY_STATUSES.QUEUED,
        wakeRetryCount: { $lt: WAKE_RETRY_MAX_COUNT },
        createdAt: { $gte: new Date(Date.now() - PENDING_NOTIFICATION_WINDOW_MS) },
      },
    },
    { $sort: { sequence: 1 } },
    { $group: { _id: '$uniqueCode', delivery: { $first: '$$ROOT' } } },
  ]);

const claimWakeRetry = (delivery) =>
  NotificationDelivery.findOneAndUpdate(
    {
      _id: delivery._id,
      status: NOTIFICATION_DELIVERY_STATUSES.QUEUED,
      wakeRetryCount: delivery.wakeRetryCount,
    },
    { $inc: { wakeRetryCount: 1 }, $set: { lastWakeRetryAt: new Date() } },
    { new: true }
  ).lean();

const claimDueWakeRetries = async () => {
  const nowMs = Date.now();
  const oldestPerUser = await findOldestQueuedDeliveryPerUser();
  const dueDeliveries = oldestPerUser.map((entry) => entry.delivery).filter((delivery) => isWakeRetryDue(delivery, nowMs));
  const claimedDeliveries = await Promise.all(dueDeliveries.map(claimWakeRetry));
  return claimedDeliveries.filter(Boolean);
};

const findQueuedDeliveries = (uniqueCode) =>
  NotificationDelivery.find({
    uniqueCode,
    status: NOTIFICATION_DELIVERY_STATUSES.QUEUED,
    createdAt: { $gte: new Date(Date.now() - PENDING_NOTIFICATION_WINDOW_MS) },
  })
    .sort({ sequence: 1 })
    .limit(PENDING_NOTIFICATION_LIMIT)
    .lean();

const acknowledgeDeliveries = async ({ uniqueCode, pushIds }) => {
  const validPushIds = (Array.isArray(pushIds) ? pushIds : [])
    .filter((pushId) => typeof pushId === 'string' && pushId)
    .slice(0, ACKNOWLEDGE_BATCH_LIMIT);
  if (validPushIds.length === 0) return;

  await NotificationDelivery.updateMany(
    { uniqueCode, pushId: { $in: validPushIds }, status: NOTIFICATION_DELIVERY_STATUSES.QUEUED },
    { $set: { status: NOTIFICATION_DELIVERY_STATUSES.DELIVERED, deliveredAt: new Date() } }
  );

  const hasRemainingDeliveries = await NotificationDelivery.exists({
    uniqueCode,
    status: NOTIFICATION_DELIVERY_STATUSES.QUEUED,
  });
  if (!hasRemainingDeliveries) {
    await NotificationDeliverySequence.updateOne({ uniqueCode }, { $set: { wakeLockUntil: null } });
  }
};

module.exports = {
  enqueueDelivery,
  claimWakePush,
  claimDueWakeRetries,
  findQueuedDeliveries,
  acknowledgeDeliveries,
};