const logger = require('#shared/logger/logger');
const { createNotification } = require('./notification.create.service');
const { resolveActorAvatarUrl } = require('./notification.actor.avatar');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { getNotificationCounts } = require('./notification.count.service');
const { enqueueDelivery, claimWakePush } = require('./notification.delivery.queue.service');
const { dispatchNotificationToUser, dispatchUnreadCountToUser } = require('#core/notification/push/push.dispatcher');

const buildPushPayload = (notification, counts, overrides = {}) => {
  const [firstAction] = notification.actions;
  const payloadActor = overrides.actor ?? notification.actor;
  const defaultPrimaryAction = firstAction
    ? { modelKey: firstAction.modelKey, documentId: firstAction.documentId, screenKey: firstAction.screenKey }
    : null;

  return {
    kind: 'notification',
    notificationId: String(notification._id),
    notificationKind: notification.kind,
    title: overrides.title ?? notification.title,
    body: overrides.body ?? notification.body,
    priority: notification.priority,
    unreadCount: counts.unread,
    totalUnread: counts.total,
    mentionsUnread: counts.mentionsUnread,
    repliesUnread: counts.repliesUnread,
    actor: payloadActor
      ? {
          uniqueCode: payloadActor.uniqueCode,
          name: payloadActor.name,
          profilePicPath: payloadActor.profilePicPath,
        }
      : null,
    primaryAction: Object.hasOwn(overrides, 'primaryAction') ? overrides.primaryAction : defaultPrimaryAction,
    actorAvatarUrl: overrides.actorAvatarUrl ?? null,
    createdAt: new Date(notification.createdAt).toISOString(),
  };
};

const logPushOutcome = (uniqueCode, result) => {
  if (result.status === 'rejected') {
    logger.error(`[notification.dispatcher] push to ${uniqueCode} failed: ${result.reason?.stack || result.reason}`);
    return;
  }
  const { pushNotification } = result.value;
  if (!pushNotification?.success) {
    logger.warn(
      `[notification.dispatcher] push to ${uniqueCode} not delivered: ${pushNotification?.message || 'unknown'}`
    );
  }
};

const pushToUsers = async (notification, uniqueCodes, overrides, avatarActor = notification.actor) => {
  const actorAvatarUrl = await resolveActorAvatarUrl(avatarActor);
  const results = await Promise.allSettled(
    uniqueCodes.map(async (uniqueCode) => {
      const counts = await getNotificationCounts(uniqueCode);
      const queuedPayload = buildPushPayload(notification, counts, {
        ...overrides,
        actorAvatarUrl,
        actor: avatarActor,
      });
      const delivery = await enqueueDelivery({ uniqueCode, payload: queuedPayload });
      const shouldPush = await claimWakePush(uniqueCode);
      if (!shouldPush) logger.info(`[notification.dispatcher] wake push suppressed for ${uniqueCode}`);
      return dispatchNotificationToUser(
        uniqueCode,
        { ...queuedPayload, pushId: delivery.pushId, sequence: delivery.sequence },
        { shouldPush }
      );
    })
  );
  results.forEach((result, index) => logPushOutcome(uniqueCodes[index], result));
  return results;
};

const syncCountsForUsers = (uniqueCodes) =>
  Promise.allSettled(
    uniqueCodes.map(async (uniqueCode) => {
      const counts = await getNotificationCounts(uniqueCode);
      return dispatchUnreadCountToUser(uniqueCode, counts);
    })
  );

const pushNotificationActivity = async (notification, uniqueCodes, { title, body, actorUniqueCode }) => {
  const avatarActor = actorUniqueCode ? await resolveActorByUniqueCode(actorUniqueCode) : notification.actor;
  await pushToUsers(notification, uniqueCodes, { title, body, primaryAction: null }, avatarActor);
  const silentAudience = notification.audience.filter((uniqueCode) => !uniqueCodes.includes(uniqueCode));
  await syncCountsForUsers(silentAudience);
};

const notifyWithStage = async (notificationInput, setStage = () => {}) => {
  setStage('creating notification');
  const notification = await createNotification(notificationInput);
  if (!notification) return null;

  setStage('dispatching notification');
  await pushToUsers(notification, notification.recipients);
  return notification;
};

const notify = (notificationInput) => notifyWithStage(notificationInput);

const notifySafely = async (notificationInput) => {
  let stage = 'creating notification';
  try {
    return await notifyWithStage(notificationInput, (currentStage) => {
      stage = currentStage;
    });
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    logger.error(`[notification.dispatcher] notifySafely failed while ${stage}: ${details}`);
    return null;
  }
};

const syncNotificationCounts = async (uniqueCode) => {
  const counts = await getNotificationCounts(uniqueCode);
  dispatchUnreadCountToUser(uniqueCode, counts);
  return counts;
};

module.exports = { notify, notifySafely, pushNotificationActivity, syncNotificationCounts };