const logger = require('#shared/logger/logger');
const webpushService = require('../webpush/webpush.service');
const { buildWebPushPayloadForSubscription } = require('./push.web.payload');

const WEB_PUSH_TTL_SECONDS = 24 * 60 * 60;
const SUBSCRIPTION_GONE_STATUS_CODES = [404, 410];

const dispatchNotificationWebPush = async (uniqueCode, payload) => {
  try {
    const subscription = await webpushService.getSubscription(uniqueCode);
    if (!subscription) return { success: false, message: 'No web push subscription' };

    await webpushService.sendPushNotification(subscription, buildWebPushPayloadForSubscription(subscription, payload), {
      TTL: WEB_PUSH_TTL_SECONDS,
      urgency: payload.priority === 'high' ? 'high' : 'normal',
    });
    return { success: true };
  } catch (error) {
    if (SUBSCRIPTION_GONE_STATUS_CODES.includes(error.statusCode)) {
      await webpushService.clearSubscription(uniqueCode);
    }
    logger.error('[push.web] dispatchNotificationWebPush', error);
    return { success: false, message: error.message };
  }
};

module.exports = { dispatchNotificationWebPush };