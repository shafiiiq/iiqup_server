const http2 = require('http2');           
const crypto = require('crypto');
const logger = require('#shared/logger/logger');
const tokenService = require('../token/token.service');

const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup';
const APNS_ORIGIN =
  process.env.APNS_ENVIRONMENT === 'development'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
const PROVIDER_TOKEN_LIFETIME_MS = 50 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;
const INVALID_TOKEN_REASONS = ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'];

let apnsSession = null;
let providerToken = null;
let providerTokenIssuedAt = 0;
let hasWarnedAboutConfiguration = false;

const isConfigured = () =>
  Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');

const getProviderToken = () => {
  const now = Date.now();
  if (providerToken && now - providerTokenIssuedAt < PROVIDER_TOKEN_LIFETIME_MS) return providerToken;

  const header = encodeBase64Url(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID }));
  const claims = encodeBase64Url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }));
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: process.env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    dsaEncoding: 'ieee-p1363',
  });

  providerToken = `${signingInput}.${encodeBase64Url(signature)}`;
  providerTokenIssuedAt = now;
  return providerToken;
};

const getSession = () => {
  if (apnsSession && !apnsSession.closed && !apnsSession.destroyed) return apnsSession;

  const session = http2.connect(APNS_ORIGIN);
  const releaseSession = () => {
    if (apnsSession === session) apnsSession = null;
  };
  session.on('error', (error) => {
    logger.error(`[push.voip] APNs session error: ${error.message}`);
    releaseSession();
  });
  session.on('close', releaseSession);
  session.on('goaway', releaseSession);
  apnsSession = session;
  return session;
};

const readFailureReason = (responseBody) => {
  try {
    return JSON.parse(responseBody).reason || '';
  } catch {
    return '';
  }
};

const sendToDevice = (voipToken, payload) =>
  new Promise((resolve) => {
    let isSettled = false;
    let status = 0;
    let responseBody = '';
    const settle = (result) => {
      if (isSettled) return;
      isSettled = true;
      resolve(result);
    };

    try {
      const request = getSession().request({
        ':method': 'POST',
        ':path': `/3/device/${voipToken}`,
        authorization: `bearer ${getProviderToken()}`,
        'apns-push-type': 'voip',
        'apns-priority': '10',
        'apns-topic': `${APNS_BUNDLE_ID}.voip`,
        'apns-expiration': '0',
      });
      request.setEncoding('utf8');
      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.close(http2.constants.NGHTTP2_CANCEL);
        settle({ status: 0, reason: 'Timeout' });
      });
      request.on('response', (headers) => {
        status = headers[':status'];
      });
      request.on('data', (chunk) => {
        responseBody += chunk;
      });
      request.on('end', () => settle({ status, reason: readFailureReason(responseBody) }));
      request.on('error', (error) => settle({ status: 0, reason: error.message }));
      request.end(JSON.stringify(payload));
    } catch (error) {
      settle({ status: 0, reason: error.message });
    }
  });

const buildVoipPayload = (payload) => ({
  kind: 'notification',
  notificationId: String(payload.notificationId),
  pushId: String(payload.pushId || ''),
  title: payload.title || '',
  body: payload.body || '',
  priority: payload.priority || 'medium',
  unreadCount: String(payload.unreadCount ?? 0),
  mentionsUnread: String(payload.mentionsUnread ?? 0),
  repliesUnread: String(payload.repliesUnread ?? 0),
  primaryAction: payload.primaryAction ? JSON.stringify(payload.primaryAction) : null,
});

const dispatchVoipPayload = async (uniqueCode, voipPayload) => {
  if (!isConfigured()) {
    if (!hasWarnedAboutConfiguration) {
      hasWarnedAboutConfiguration = true;
      logger.warn('[push.voip] APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY are required for VoIP pushes');
    }
    return { success: false, message: 'VoIP push is not configured' };
  }

  try {
    const user = await tokenService.findUserByUniqueCode(uniqueCode, 'uniqueCode voipPushToken');
    const voipToken = user?.voipPushToken;
    if (!voipToken) return { success: false, message: 'No VoIP token' };

    const result = await sendToDevice(voipToken, voipPayload);
    if (result.status === 200) return { success: true };

    if (INVALID_TOKEN_REASONS.includes(result.reason)) await tokenService.clearVoipToken(voipToken);
    logger.error(`[push.voip] ${uniqueCode} rejected: status ${result.status} ${result.reason}`);
    return { success: false, message: result.reason || `APNs status ${result.status}` };
  } catch (error) {
    logger.error('[push.voip] dispatchVoipNotificationPush', error);
    return { success: false, message: error.message };
  }
};

const dispatchVoipNotificationPush = (uniqueCode, payload) =>
  dispatchVoipPayload(uniqueCode, buildVoipPayload(payload));

const dispatchVoipCallPush = (uniqueCode, { callerName, callerId, chatId }) =>
  dispatchVoipPayload(uniqueCode, {
    kind: 'call',
    type: 'call',
    callAction: 'incoming',
    callerId: String(callerId),
    callerName: String(callerName),
    chatId: String(chatId),
  });

module.exports = { dispatchVoipNotificationPush, dispatchVoipCallPush };