// notification.push.js
const logger = require('#shared/logger/logger');
const admin = require('./firebase/firebase.init');
const webpush = require('web-push');
const http2 = require('http2');
const jwt = require('jsonwebtoken');
const {
  dispatchUserWebSocketNotification,
  dispatchBroadcastWebSocketNotification,
} = require('../socket/socket.io');
const User = require('#features/user/staff/staff.model');
const notificationToken = require('./notification.token');
const notificationEvents = require('./notification.events');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const dispatchBroadcastNotification = async (notificationData) => {
  logger.info('[notification.push] dispatchBroadcastNotification');

  const results = {
    websocket: wrapWebSocketDispatch(() => dispatchBroadcastWebSocketNotification(notificationData)),
    pushNotification: { success: false },
  };

  try {
    const activeUsers = await User.find({ isActive: true }).select('uniqueCode');
    const uniqueCodes = activeUsers.map((u) => u.uniqueCode);

    if (uniqueCodes.length > 0) {
      const perUserDispatch = await dispatchNotificationToUsers(uniqueCodes, notificationData);
      results.pushNotification = perUserDispatch.data?.pushNotification || { success: false };
      results.details = perUserDispatch.data?.details || [];
      results.voip = (perUserDispatch.data?.details || []).map((d) => ({
        uniqueCode: d.uniqueCode,
        voip: d.voip,
      }));
    }
  } catch (error) {
    results.pushNotification = { success: false, error: error.message };
  }

  const overallSuccess = results.websocket.success || results.pushNotification.success;
  return {
    success: overallSuccess,
    message: overallSuccess ? 'Broadcast sent successfully' : 'Failed to send broadcast',
    data: results,
  };
};

const dispatchNotificationToUsers = async (uniqueCodes, notificationData) => {
  logger.info('[notification.push] dispatchNotificationToUsers', uniqueCodes.length);

  if (!Array.isArray(uniqueCodes) || uniqueCodes.length === 0) {
    return { success: false, message: 'No user IDs provided' };
  }

  const details = await Promise.all(
    uniqueCodes.map((uniqueCode) => dispatchNotificationChannels(uniqueCode, notificationData))
  );

  const results = {
    websocket: {
      success: details.filter((d) => d.websocket.success).length,
      failed: details.filter((d) => !d.websocket.success).length,
    },
    pushNotification: {
      success: details.filter((d) => d.pushNotification.success).length,
      failed: details.filter((d) => !d.pushNotification.success).length,
    },
    details,
  };

  const overallSuccess = results.websocket.success > 0 || results.pushNotification.success > 0;
  logger.info(
    `[notification.push] dispatchNotificationToUsers (${results.websocket.success}/${uniqueCodes.length} websocket, ${results.pushNotification.success}/${uniqueCodes.length} push)`
  );

  return {
    success: overallSuccess,
    message: overallSuccess ? 'Notifications sent' : 'Failed to send notifications',
    data: results,
  };
};

const dispatchNotificationToUser = async (uniqueCode, notificationData) => {
  logger.info('[notification.push] dispatchNotificationToUser', uniqueCode);

  const { websocket, pushNotification, voip } = await dispatchNotificationChannels(uniqueCode, notificationData);
  logger.info('[notification.push] dispatchNotificationToUser', voip?.success);

  const overallSuccess = websocket.success || pushNotification.success;
  return {
    success: overallSuccess,
    message: overallSuccess ? 'Notification sent successfully' : 'Failed to send notification',
    data: { websocket, pushNotification },
  };
};

const dispatchNotificationChannels = async (uniqueCode, notificationData) => {
  const websocket = wrapWebSocketDispatch(() =>
    dispatchUserWebSocketNotification(uniqueCode, notificationData)
  );

  let pushNotification;
  try {
    pushNotification = await dispatchFcmPushToUser(uniqueCode, notificationData);
  } catch (error) {
    pushNotification = { success: false, error: error.message };
  }

  const voip = await dispatchVoipSyncToTarget(
    uniqueCode,
    notificationData._id || notificationData.notificationId
  );

  await dispatchWebPushToUser(uniqueCode, notificationData);

  return { uniqueCode, websocket, pushNotification, voip };
};

const wrapWebSocketDispatch = (dispatchFn) => {
  try {
    dispatchFn();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const dispatchFcmPushToUser = async (uniqueCode, notificationData) => {
  try {
    const user = await notificationToken.findUserByUniqueCode(uniqueCode);
    if (!user) return { success: false, message: 'User not found' };

    const activeTokens = getActiveTokens(user);
    if (activeTokens.length === 0)
      return { success: false, message: 'No valid push tokens found for this user' };

    const message = buildNotificationMessage(notificationData);
    const results = await deliverToTokens(activeTokens, message);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    await Promise.allSettled(
      results
        .map((result, index) => ({ result, token: activeTokens[index] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ token }) => notificationToken.deactivateToken(token))
    );

    return {
      success: successful > 0,
      message: `Sent: ${successful} successful, ${failed} failed`,
      data: { successful, failed, total: activeTokens.length },
    };
  } catch (error) {
    logger.error('[notification.push] dispatchFcmPushToUser', error);
    return { success: false, message: 'Failed to send notification', error: error.message };
  }
};

const dispatchVoipSyncToTarget = (uniqueCodeOrCodes, notificationId) => {
  if (Array.isArray(uniqueCodeOrCodes)) {
    return Promise.all(
      uniqueCodeOrCodes.map((code) =>
        dispatchVoipSyncPush(code, notificationId).catch(() => ({ success: false }))
      )
    );
  }
  return dispatchVoipSyncPush(uniqueCodeOrCodes, notificationId).catch(() => ({ success: false }));
};

const dispatchVoipSyncPush = async (uniqueCode, notificationId) => {
  try {
    const user = await notificationToken.findUserByUniqueCode(uniqueCode, 'uniqueCode voipPushToken');
    if (!user?.voipPushToken) return { success: false };

    let apnsJwt;
    try {
      apnsJwt = buildApnsJwt();
    } catch (error) {
      logger.error('[notification.push] dispatchVoipSyncPush', error.message);
      return { success: false, error: error.message };
    }

    const forceProd = String(process.env.APNS_FORCE_PROD || '').toLowerCase() === 'true';
    const isProd = forceProd || process.env.NODE_ENV === 'production';
    const host = isProd ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

    const payload = JSON.stringify({
      aps: { 'content-available': 1 },
      notificationId: String(notificationId),
      type: 'sync',
    });

    const collapseId = notificationId
      ? `${notificationId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`
      : `sync_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const headers = {
      authorization: `bearer ${apnsJwt.token}`,
      'apns-topic': `${apnsJwt.bundleId}.voip`,
      'apns-push-type': 'voip',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
      'apns-collapse-id': collapseId,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    };

    return await postApnsRequest(host, `/3/device/${user.voipPushToken}`, headers, payload);
  } catch (error) {
    logger.error('[notification.push] dispatchVoipSyncPush', error);
    return { success: false };
  }
};

const buildApnsJwt = () => {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const apnsAuthKey = process.env.APNS_AUTH_KEY;

  if (!teamId || !keyId || !bundleId) {
    throw new Error('APNS configuration incomplete');
  }
  if (!apnsAuthKey) {
    throw new Error('APNS auth key not configured');
  }

  const privateKey = Buffer.from(apnsAuthKey, 'base64').toString('utf-8');

  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
    issuer: teamId,
    audience: 'https://api.push.apple.com',
    expiresIn: '1h',
  });

  return { token, bundleId };
};

const postApnsRequest = (host, path, headers, payload) =>
  new Promise((resolve) => {
    const client = http2.connect(host);

    client.on('error', (error) => {
      logger.error('[notification.push] postApnsRequest', error);
      resolve({ success: false });
    });

    const req = client.request({ ':method': 'POST', ':path': path, ...headers });
    req.write(payload);
    req.end();

    req.on('response', (responseHeaders) => {
      const status = responseHeaders[':status'];
      logger.info('[notification.push] postApnsRequest', status);
      client.close();
      resolve({ success: status === 200 });
    });

    req.on('error', (error) => {
      logger.error('[notification.push] postApnsRequest', error);
      client.close();
      resolve({ success: false });
    });
  });

const dispatchWebPushToUser = async (uniqueCode, notificationData) => {
  try {
    const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
    if (!user?.webPushSubscription) return;

    await webpush.sendNotification(
      user.webPushSubscription,
      JSON.stringify({
        title: notificationData.title,
        description: notificationData.description || notificationData.message,
      })
    );
  } catch (error) {
    if (error.statusCode === 410) {
      await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: null } });
    }
  }
};

const dispatchDismissNotification = (uniqueCode, notificationId) => {
  const message = {
    data: { action: 'dismiss', notificationId: String(notificationId) },
    android: {
      priority: 'high',
      data: { action: 'dismiss', notificationId: String(notificationId) },
    },
    apns: { payload: { aps: { 'content-available': 1 } } },
  };

  return dispatchRawPushToUser(uniqueCode, message, 'dispatchDismissNotification');
};

const dispatchVoipCallNotification = (uniqueCode, callerName, callerId, chatId) => {
  const message = {
    data: {
      type: 'call',
      callAction: 'incoming',
      callerId: String(callerId),
      callerName: String(callerName),
      chatId: String(chatId),
      notificationId: `call_${callerId}_${Date.now()}`,
    },
    notification: {
      title: `Incoming call from ${callerName}`,
      body: 'Tap to answer',
    },
    android: {
      priority: 'max',
      notification: {
        channelId: 'call_channel',
        sound: 'call_ringtone',
        priority: 'max',
        visibility: 'public',
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
        'apns-collapse-id': `call_${callerId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      },
      payload: {
        aps: {
          alert: {
            title: `Incoming call from ${callerName}`,
            body: 'Tap to answer',
          },
          sound: 'default',
          'content-available': 1,
          category: 'CALL_INVITATION',
        },
      },
    },
  };

  return dispatchRawPushToUser(uniqueCode, message, 'dispatchVoipCallNotification');
};

const dispatchRawPushToUser = async (uniqueCode, message, logTag) => {
  try {
    const user = await notificationToken.findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    const activeTokens = getActiveTokens(user);
    if (activeTokens.length === 0) return { success: false };

    await deliverToTokens(activeTokens, message);
    return { success: true };
  } catch (error) {
    logger.error(`[notification.push] ${logTag}`, error);
    return { success: false };
  }
};

const dispatchNetworkReconnectPush = async (uniqueCode) => {
  try {
    const user = await notificationToken.findUserByUniqueCode(uniqueCode, 'uniqueCode pushTokens');
    if (!user) return { success: false, message: 'User not found' };

    const iosTokens = (user.pushTokens || [])
      .filter((t) => t.isActive && t.platform === 'ios')
      .map((t) => t.token);
    if (iosTokens.length === 0) return { success: false, message: 'No iOS tokens' };

    const silentMessage = {
      data: {
        type: 'network-reconnect',
        action: 'sync',
        timestamp: Date.now().toString(),
      },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
          'apns-topic': process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
          'apns-collapse-id': `reconnect_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        },
        payload: { aps: { 'content-available': 1 } },
      },
    };

    await deliverToTokens(iosTokens, silentMessage);
    return { success: true };
  } catch (error) {
    logger.error('[notification.push] dispatchNetworkReconnectPush', error);
    return { success: false, error: error.message };
  }
};

const buildNotificationMessage = (notificationData = {}) => {
  const title = String(notificationData.title || 'New Notification');
  const body = String(notificationData.description || notificationData.message || '');
  const notificationId = String(notificationData.notificationId || notificationData._id?.toString() || '');
  const type = String(notificationData.type || 'normal');
  const priority = String(notificationData.priority || 'medium');
  const isCall = type === 'call';

  const message = {
    notification: { title, body },
    data: { notificationId, type, priority, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup',
        'apns-expiration': String(
          notificationData.apnsExpiration || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        ),
        'apns-collapse-id': String(
          notificationData.apnsCollapseId ||
            `${notificationId || 'notif'}_${Date.now()}_${Math.floor(Math.random() * 100000)}`
        ),
      },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
          'content-available': 1,
          'mutable-content': 1,
        },
      },
    },
    android: {
      priority: isCall ? 'max' : 'high',
      notification: { title, body, sound: 'default' },
    },
  };

  if (isCall) {
    message.data.callAction = 'incoming';
    message.data.callerId = String(notificationData.callerId || '');
    message.data.callerName = String(notificationData.callerName || '');
    message.apns.payload.aps.category = 'CALL_INVITATION';
  }

  return message;
};

const getActiveTokens = (user) =>
  (user?.pushTokens || [])
    .filter((t) => t.isActive && t.token)
    .map((t) => t.token);

const deliverToTokens = (tokens, message) =>
  Promise.allSettled(tokens.map((token) => admin.messaging().send({ ...message, token })));

notificationEvents.on('dismiss-notification', ({ uniqueCode, notificationId }) => {
  dispatchDismissNotification(uniqueCode, notificationId).catch((error) =>
    logger.error('[notification.push] dismiss-notification listener', error)
  );
});

notificationEvents.on('send-general-notification', ({ uniqueCode, title, description, priority, type, notificationId }) => {
  dispatchNotificationToUser(uniqueCode, { title, description, priority, type, notificationId }).catch((error) =>
    logger.error('[notification.push] send-general-notification listener', error)
  );
});

notificationEvents.on('voip-call-notification', ({ uniqueCode, callerName, callerId, chatId }) => {
  dispatchVoipCallNotification(uniqueCode, callerName, callerId, chatId).catch((error) =>
    logger.error('[notification.push] voip-call-notification listener', error)
  );
});

module.exports = {
  dispatchNotificationToUser,
  dispatchNotificationToUsers,
  dispatchBroadcastNotification,
  dispatchDismissNotification,
  dispatchVoipCallNotification,
  dispatchVoipSyncPush,
  dispatchNetworkReconnectPush,
};