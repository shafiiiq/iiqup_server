// services/token.service.js
const admin = require('../utils/firebase.utils');
const User = require('../models/user.model.js');
const Mechanic = require('../models/mechanic.model.js');
const Operator = require('../models/operator.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const findUserByUniqueCode = async (
  uniqueCode,
  projection = 'uniqueCode name pushTokens'
) => {
  let user = await User.findOne({ uniqueCode }).select(projection);
  if (!user) user = await Operator.findOne({ uniqueCode }).select(projection);
  if (!user) user = await Mechanic.findOne({ uniqueCode }).select(projection);
  return user;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers or updates a push token for a user.
 * @param {string} uniqueCode
 * @param {string} pushToken
 * @param {string|null} platform
 * @returns {Promise}
 */
const insertPushToken = async (uniqueCode, pushToken, platform = null) => {
  try {
    const tokenString = String(pushToken || '');
    if (!tokenString || tokenString.length < 100)
      return { success: false, message: 'Invalid push token format' };
    console.log(
      `[TokenService] register-push-token platform=${platform || 'unknown'} tokenLength=${tokenString.length}`
    );

    const user = await findUserByUniqueCode(
      uniqueCode,
      'uniqueCode pushTokens'
    );
    if (!user) return { success: false, message: 'User not found' };

    if (!user.pushTokens) user.pushTokens = [];

    const existingIndex = user.pushTokens.findIndex(
      (t) => t.token === pushToken
    );

    if (existingIndex !== -1) {
      user.pushTokens[existingIndex] = {
        token: pushToken,
        platform: platform || user.pushTokens[existingIndex].platform,
        registeredAt: new Date(),
        isActive: true,
      };
    } else {
      user.pushTokens.push({
        token: pushToken,
        platform,
        registeredAt: new Date(),
        isActive: true,
      });
    }

    user.updatedAt = new Date();
    await user.save();

    return {
      success: true,
      message: 'Push token registered successfully',
      data: {
        uniqueCode: user.uniqueCode,
        tokenCount: user.pushTokens.length,
        platform,
      },
    };
  } catch (error) {
    console.error('[TokenService] insertPushToken:', error);
    return {
      success: false,
      message: 'Failed to register push token',
      error: error.message,
    };
  }
};

const insertVoipToken = async (uniqueCode, voipToken) => {
  try {
    const tokenString = String(voipToken || '');
    if (!tokenString) return { success: false, message: 'Invalid VoIP token' };

    const models = [User, Operator, Mechanic];
    for (const Model of models) {
      const updated = await Model.findOneAndUpdate(
        { uniqueCode },
        { voipPushToken: tokenString, updatedAt: new Date() },
        { new: true }
      );
      if (updated) {
        console.log(
          `VoIP token for ${Model.modelName} ${uniqueCode} updated to: ${tokenString}`
        );
        return { success: true, message: 'VoIP token registered successfully' };
      }
    }

    return { success: false, message: 'User not found' };
  } catch (error) {
    console.error('[TokenService] insertVoipToken:', error);
    return {
      success: false,
      message: 'Failed to register VoIP token',
      error: error.message,
    };
  }
};

/**
 * Removes a specific push token from a user.
 * @param {string} uniqueCode
 * @param {string} pushToken
 * @returns {Promise}
 */
const removePushToken = async (uniqueCode, pushToken) => {
  try {
    const user = await findUserByUniqueCode(
      uniqueCode,
      'uniqueCode pushTokens'
    );
    if (!user) return { success: false, message: 'User not found' };
    if (!user.pushTokens || user.pushTokens.length === 0)
      return { success: false, message: 'No push tokens found for this user' };

    const initialLength = user.pushTokens.length;
    user.pushTokens = user.pushTokens.filter((t) => t.token !== pushToken);

    if (user.pushTokens.length === initialLength)
      return { success: false, message: 'Push token not found' };

    user.updatedAt = new Date();
    await user.save();

    return { success: true, message: 'Push token removed successfully' };
  } catch (error) {
    console.error('[TokenService] removePushToken:', error);
    return {
      success: false,
      message: 'Failed to remove push token',
      error: error.message,
    };
  }
};

/**
 * Removes invalid FCM tokens from all (or one) user.
 * @param {string|null} uniqueCode
 * @returns {Promise}
 */
const cleanupInvalidTokens = async (uniqueCode = null) => {
  try {
    const query = uniqueCode ? { uniqueCode } : {};
    const users = await User.find(query);
    let totalCleaned = 0;

    for (const user of users) {
      if (!user.pushTokens || user.pushTokens.length === 0) continue;
      const initialLength = user.pushTokens.length;
      user.pushTokens = user.pushTokens.filter(
        (t) => t.token && typeof t.token === 'string' && t.token.length > 100
      );
      const cleaned = initialLength - user.pushTokens.length;
      if (cleaned > 0) {
        user.updatedAt = new Date();
        await user.save();
        totalCleaned += cleaned;
      }
    }

    return {
      success: true,
      message: `Cleaned up ${totalCleaned} invalid tokens`,
      data: { cleaned: totalCleaned },
    };
  } catch (error) {
    console.error('[TokenService] cleanupInvalidTokens:', error);
    return {
      success: false,
      message: 'Failed to cleanup tokens',
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets all push tokens for a user.
 * @param {string} uniqueCode
 * @returns {Promise}
 */
const getUserPushTokens = async (uniqueCode) => {
  try {
    const user = await User.findOne({ uniqueCode }).select(
      'uniqueCode name pushTokens'
    );
    if (!user) return { success: false, message: 'User not found' };
    return {
      success: true,
      data: {
        uniqueCode: user.uniqueCode,
        name: user.name,
        pushTokens: user.pushTokens || [],
        tokenCount: user.pushTokens?.length || 0,
      },
    };
  } catch (error) {
    console.error('[TokenService] getUserPushTokens:', error);
    return {
      success: false,
      message: 'Failed to get push tokens',
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Send
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds an FCM payload that works reliably for both Android and iOS.
 * The APNs block is explicit so Apple devices show the alert instead of
 * silently dropping it.
 */
const buildNotificationMessage = (notificationData = {}) => {
  const title = String(notificationData.title || 'New Notification');
  const body = String(
    notificationData.description || notificationData.message || ''
  );
  const notificationId = String(
    notificationData.notificationId || notificationData._id?.toString() || ''
  );
  const type = String(notificationData.type || 'normal');
  const priority = String(notificationData.priority || 'medium');
  const isCall = type === 'call';

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      notificationId,
      type,
      priority,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': process.env.APNS_BUNDLE_ID || 'com.iiqup.ansarigroup',
        // Default apns-expiration: 30 days from now (in seconds since epoch)
        'apns-expiration': String(
          notificationData.apnsExpiration ||
            Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        ),
        // apns-collapse-id: ensure uniqueness per notification to avoid collapsing
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
    message.apns.payload.aps['content-available'] = 1;
    message.apns.payload.aps.category = 'CALL_INVITATION';
  }

  return message;
};

/**
 * Sends a push notification to a single user via FCM.
 * @param {string} uniqueCode
 * @param {object} notificationData
 * @returns {Promise}
 */
const sendNotificationToUser = async (uniqueCode, notificationData) => {
  try {
    const user = await findUserByUniqueCode(uniqueCode);
    if (!user) return { success: false, message: 'User not found' };
    if (!user.pushTokens || user.pushTokens.length === 0)
      return { success: false, message: 'No push tokens found for this user' };

    const activeTokens = user.pushTokens
      .filter((t) => t.isActive && t.token)
      .map((t) => t.token);
    if (activeTokens.length === 0)
      return {
        success: false,
        message: 'No valid push tokens found for this user',
      };

    const message = buildNotificationMessage(notificationData);

    const results = await Promise.allSettled(
      activeTokens.map((token) => admin.messaging().send({ ...message, token }))
    );
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // If some tokens failed, mark them inactive to avoid repeated failures
    try {
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'rejected') {
          const failedToken = activeTokens[i];
          // console.error('[TokenService] token send failed for token:', failedToken, 'error:', res.reason && (res.reason.message || res.reason));
          try {
            await User.updateOne(
              { 'pushTokens.token': failedToken },
              {
                $set: { 'pushTokens.$.isActive': false, updatedAt: new Date() },
              }
            );
          } catch (e) {
            console.error(
              '[TokenService] failed to mark token inactive:',
              e.message || e
            );
          }
        }
      }
    } catch (e) {
      console.error(
        '[TokenService] error processing send results:',
        e.message || e
      );
    }

    return {
      success: successful > 0,
      message: `Sent: ${successful} successful, ${failed} failed`,
      data: { successful, failed, total: activeTokens.length },
    };
  } catch (error) {
    console.error('[TokenService] sendNotificationToUser:', error);
    return {
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    };
  }
};

/**
 * Sends a push notification to all tokens of the super admin user.
 * @param {Array} uniqueCodes
 * @param {object} notificationData
 * @returns {Promise}
 */
const sendBulkNotifications = async (uniqueCodes, notificationData) => {
  try {
    const user = await findUserByUniqueCode(process.env.SUPER_ADMIN);
    if (!user || !user.pushTokens || user.pushTokens.length === 0)
      return { success: false, message: 'No tokens found' };

    const activeTokens = user.pushTokens
      .filter((t) => t.isActive && t.token && t.token.length > 100)
      .map((t) => t.token);
    if (activeTokens.length === 0)
      return { success: false, message: 'No valid tokens' };

    const message = buildNotificationMessage({
      ...notificationData,
      title: notificationData.title || 'Test',
      description:
        notificationData.description || notificationData.message || 'Test',
    });

    const results = await Promise.allSettled(
      activeTokens.map((token) => admin.messaging().send({ ...message, token }))
    );
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      success: successful > 0,
      data: { successful, failed, total: activeTokens.length },
    };
  } catch (error) {
    console.error('[TokenService] sendBulkNotifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a silent background push to iOS devices only (network reconnect).
 * @param {string} uniqueCode
 * @returns {Promise}
 */
const sendNetworkReconnectPush = async (uniqueCode) => {
  try {
    const user = await findUserByUniqueCode(
      uniqueCode,
      'uniqueCode pushTokens'
    );
    if (!user) return { success: false, message: 'User not found' };

    const iosTokens = (user.pushTokens || [])
      .filter((t) => t.isActive && t.platform === 'ios')
      .map((t) => t.token);
    if (iosTokens.length === 0)
      return { success: false, message: 'No iOS tokens' };

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
          'apns-expiration': String(
            Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
          ),
          'apns-collapse-id': `reconnect_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        },
        payload: { aps: { 'content-available': 1 } },
      },
    };

    await Promise.allSettled(
      iosTokens.map((token) =>
        admin.messaging().send({ ...silentMessage, token })
      )
    );
    return { success: true };
  } catch (error) {
    console.error('[TokenService] sendNetworkReconnectPush:', error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertPushToken,
  removePushToken,
  cleanupInvalidTokens,
  getUserPushTokens,
  sendNotificationToUser,
  sendBulkNotifications,
  sendNetworkReconnectPush,
  insertVoipToken,
  buildNotificationMessage,
};
