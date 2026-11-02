const logger = require('#shared/logger/logger');
const admin = require('../firebase/firebase.init');
const tokenService = require('../token/token.service');
const { buildSyncPayload } = require('../sync/sync.payload');

const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup';
const APNS_EXPIRATION_SECONDS = 30 * 24 * 60 * 60;
const APNS_COLLAPSE_ID_MAX_LENGTH = 64;
const UNREGISTERED_TOKEN_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

const toStringMap = (values) =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );

const buildApnsHeaders = (collapseId, pushType = 'alert') => ({
  'apns-priority': '10', 
  'apns-push-type': pushType,
  'apns-topic': APNS_BUNDLE_ID,
  'apns-expiration': String(Math.floor(Date.now() / 1000) + APNS_EXPIRATION_SECONDS),
  'apns-collapse-id': String(collapseId).slice(0, APNS_COLLAPSE_ID_MAX_LENGTH),
});

const getActiveTokens = (user) =>
  (user?.pushTokens || []).filter((entry) => entry.isActive && entry.token).map((entry) => entry.token);

const deliverToTokens = (tokens, message) =>
  Promise.allSettled(tokens.map((token) => admin.messaging().send({ ...message, token })));

const deactivateUnregisteredTokens = (results, tokens) =>
  Promise.allSettled(
    results
      .map((result, index) => ({ result, token: tokens[index] }))
      .filter(({ result }) => result.status === 'rejected' && UNREGISTERED_TOKEN_ERROR_CODES.includes(result.reason?.code))
      .map(({ token }) => tokenService.deactivateToken(token))
  );

const dispatchMessageToUser = async (uniqueCode, message) => {
  try {
    const user = await tokenService.findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    const tokens = getActiveTokens(user);
    if (tokens.length === 0) {
      logger.warn(`[push.fcm] ${uniqueCode} has no active push tokens`);
      return { success: false, message: 'No active push tokens' };
    }

    const results = await deliverToTokens(tokens, message);
    results.forEach((result) => {
      if (result.status === 'fulfilled') logger.info(`[push.fcm] send to ${uniqueCode} accepted: ${result.value}`);
      if (result.status === 'rejected') {
        logger.error(`[push.fcm] send to ${uniqueCode} failed: ${result.reason?.code} ${result.reason?.message}`);
      }
    });
    await deactivateUnregisteredTokens(results, tokens);

    const delivered = results.filter((result) => result.status === 'fulfilled').length;
    return { success: delivered > 0, delivered, failed: results.length - delivered };
  } catch (error) {
    logger.error('[push.fcm] dispatchMessageToUser', error);
    return { success: false, message: error.message };
  }
};

const buildNotificationMessage = (payload, uniqueCode) => {
  const {
    notificationId,
    pushId,
    sequence,
    title,
    body,
    priority,
    unreadCount,
    totalUnread,
    mentionsUnread,
    repliesUnread,
    primaryAction,
    actor,
    actorAvatarUrl,
  } = payload;
  return {
    data: toStringMap({
      kind: 'notification',
      notificationId,
      pushId,
      sequence,
      title,
      body,
      priority,
      unreadCount,
      mentionsUnread,
      repliesUnread,
      actorName: actor?.name,
      actorUniqueCode: actor?.uniqueCode,
      actorAvatarUrl,
      primaryAction: primaryAction ? JSON.stringify(primaryAction) : undefined,
    }),
    apns: {
      headers: buildApnsHeaders(pushId || notificationId),
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: Number(totalUnread) || 0,
          'mutable-content': 1,
          'interruption-level': 'time-sensitive',
        },
        ...buildSyncPayload(uniqueCode),
        ...(actor
          ? {
              actorName: actor.name,
              actorUniqueCode: actor.uniqueCode,
            }
          : {}),
        ...(actorAvatarUrl ? { actorAvatarUrl } : {}),
      },
    },
    android: { priority: 'high' },
  };
};

const buildTypingMessage = ({ title, description, notificationId }) => ({
  notification: { title, body: description },
  data: toStringMap({ kind: 'typing', notificationId }),
  apns: {
    headers: buildApnsHeaders(notificationId),
    payload: { aps: { alert: { title, body: description }, sound: 'default' } },
  },
  android: { priority: 'high', notification: { channelId: 'silent', sound: 'default' } },
});

const buildDismissMessage = (notificationId) => ({
  data: toStringMap({ action: 'dismiss', notificationId }),
  android: { priority: 'high' },
  apns: {
    headers: buildApnsHeaders(`dismiss_${notificationId}`, 'background'),
    payload: { aps: { 'content-available': 1 } },
  },
});

const dispatchNotificationPush = (uniqueCode, payload) =>
  dispatchMessageToUser(uniqueCode, buildNotificationMessage(payload, uniqueCode));

const dispatchTypingPush = (uniqueCode, typingPayload) =>
  dispatchMessageToUser(uniqueCode, buildTypingMessage(typingPayload));

const dispatchDismissPush = (uniqueCode, notificationId) =>
  dispatchMessageToUser(uniqueCode, buildDismissMessage(notificationId));

module.exports = {
  buildApnsHeaders,
  dispatchMessageToUser,
  dispatchNotificationPush,
  dispatchTypingPush,
  dispatchDismissPush,
};