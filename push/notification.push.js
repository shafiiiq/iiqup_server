// push/notification.push.js
const admin          = require('../utils/firebase.utils');
const tokenService   = require('../services/token.service');
const { sendNotificationToUser: sendWebSocketNotification, broadcastNotification: broadcastWebSocketNotification } = require('../sockets/websocket').default;
const User     = require('../models/user.model');
const Operator = require('../models/operator.model');
const Mechanic = require('../models/mechanic.model');
const { default: mongoose } = require('mongoose');
const webpush = require('web-push'); 

// ─────────────────────────────────────────────────────────────────────────────
// Setup Web Push
// ─────────────────────────────────────────────────────────────────────────────

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// FCM Direct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a dismiss signal to a user's devices via FCM.
 * @param {string} uniqueCode
 * @param {string} notificationId
 * @returns {Promise}
 */
const dismissNotification = async (uniqueCode, notificationId) => {
  try {
    let user = await User.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user) user = await Operator.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user) user = await Mechanic.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user?.pushTokens?.length) return { success: false };

    const activeTokens = user.pushTokens.filter(t => t.isActive && t.token).map(t => t.token);
    if (activeTokens.length === 0) return { success: false };

    const message = {
      data:    { action: 'dismiss', notificationId: String(notificationId) },
      android: { priority: 'high', data: { action: 'dismiss', notificationId: String(notificationId) } },
      apns:    { payload: { aps: { 'content-available': 1 } } }
    };

    await Promise.allSettled(activeTokens.map(token => admin.messaging().send({ ...message, token })));
    return { success: true };
  } catch (error) {
    console.error('[NotificationPush] dismissNotification:', error);
    return { success: false };
  }
};

/**
 * Sends a VoIP call notification via FCM.
 * @param {string} uniqueCode
 * @param {string} callerName
 * @param {string} callerId
 * @param {string} chatId
 * @returns {Promise}
 */
const sendVoIPCallNotification = async (uniqueCode, callerName, callerId, chatId) => {
  try {
    let user = await User.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user) user = await Operator.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user) user = await Mechanic.findOne({ uniqueCode }).select('uniqueCode pushTokens');
    if (!user?.pushTokens?.length) return { success: false };

    const activeTokens = user.pushTokens.filter(t => t.isActive && t.token).map(t => t.token);
    if (activeTokens.length === 0) return { success: false };

    const message = {
      data: { type: 'call', callAction: 'incoming', callerId: String(callerId), callerName: String(callerName), chatId: String(chatId), notificationId: `call_${callerId}_${Date.now()}` },
      notification: { title: `Incoming call from ${callerName}`, body: 'Tap to answer' },
      android: { priority: 'max', notification: { channelId: 'call_channel', sound: 'call_ringtone', priority: 'max', visibility: 'public' } },
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: { aps: { alert: { title: `Incoming call from ${callerName}`, body: 'Tap to answer' }, sound: 'default', 'content-available': 1, category: 'CALL_INVITATION' } }
      }
    };

    await Promise.allSettled(activeTokens.map(token => admin.messaging().send({ ...message, token })));
    return { success: true };
  } catch (error) {
    console.error('[NotificationPush] sendVoIPCallNotification:', error);
    return { success: false };
  }
};

const sendVoipSyncPush = async (uniqueCode, notificationId) => {
  try {
    const user = await User.findOne({ uniqueCode }).select('voipPushToken')
    if (!user?.voipPushToken) return { success: false }

    const http2  = require('http2')
    const jwt    = require('jsonwebtoken')
    const fs     = require('fs')

    const teamId   = process.env.APNS_TEAM_ID
    const keyId    = process.env.APNS_KEY_ID
    const keyPath  = process.env.APNS_KEY_PATH
    const bundleId = process.env.APNS_BUNDLE_ID

    const privateKey = fs.readFileSync(keyPath)
    const jwtToken = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      keyid:     keyId,
      issuer:    teamId,
      audience:  'https://api.push.apple.com',
      expiresIn: '1h',
    })

    const isProd = process.env.NODE_ENV === 'production'
    const host   = isProd ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com'

    const payload = JSON.stringify({
      aps: { 'content-available': 1 },
      notificationId: String(notificationId),
      type: 'sync',
    })

    return new Promise((resolve) => {
      const client = http2.connect(host)

      client.on('error', (err) => {
        console.error('[NotificationPush] sendVoipSyncPush http2 error:', err)
        resolve({ success: false })
      })

      const req = client.request({
        ':method':        'POST',
        ':path':          `/3/device/${user.voipPushToken}`,
        'authorization':  `bearer ${jwtToken}`,
        'apns-topic':     `${bundleId}.voip`,
        'apns-push-type': 'voip',
        'apns-priority':  '10',
        'content-type':   'application/json',
        'content-length': Buffer.byteLength(payload),
      })

      req.write(payload)
      req.end()

      req.on('response', (headers) => {
        const status = headers[':status']
        console.log('[NotificationPush] sendVoipSyncPush status:', status)
        client.close()
        resolve({ success: status === 200 })
      })

      req.on('error', (err) => {
        console.error('[NotificationPush] sendVoipSyncPush req error:', err)
        client.close()
        resolve({ success: false })
      })
    })
  } catch (error) {
    console.error('[NotificationPush] sendVoipSyncPush:', error)
    return { success: false }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Notifications (user DB storage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores or updates a special (stock/equipment) notification in the user's record.
 * @param {string} uniqueCode
 * @param {number} stockCount
 * @param {string} stockId
 * @param {string} message
 * @returns {Promise}
 */
const pushSpecialNotification = async (uniqueCode, stockCount, stockId, message) => {
  try {
    const user = await User.findOne({ uniqueCode });
    if (!user) return { status: 404, message: 'User not found', data: null };

    const notification = {
      title:       'Low stock',
      description: { message, stockCount, status: 'low_stock' },
      time:        new Date(),
      priority:    'high',
      stockId,
    };

    const existingIndex = user.specialNotification.findIndex(n => n.stockId.toString() === stockId.toString());

    if (existingIndex !== -1) {
      user.specialNotification[existingIndex] = notification;
    } else {
      user.specialNotification.push(notification);
    }

    user.updatedAt = new Date();
    await user.save();

    return {
      status: 200,
      message: existingIndex !== -1 ? 'Special notification updated successfully' : 'Special notification added successfully',
      data: { notification, totalNotifications: user.specialNotification.length, isUpdate: existingIndex !== -1 }
    };
  } catch (error) {
    console.error('[NotificationPush] pushSpecialNotification:', error);
    return { status: 500, message: 'Error adding/updating special notification', data: null };
  }
};

/**
 * Fetches special notifications for a user with joined stock data.
 * @param {string} uniqueCode
 * @returns {Promise}
 */
const fetchSpecialNotification = async (uniqueCode) => {
  try {
    const result = await User.aggregate([
      { $match: { uniqueCode } },
      { $lookup: { from: 'stocks', localField: 'specialNotification.stockId', foreignField: '_id', as: 'stockData' } },
      { $project: { _id: 1, name: 1, email: 1, uniqueCode: 1, specialNotification: 1, stockData: 1 } }
    ]);

    if (!result || result.length === 0) return { status: 404, message: 'User not found', data: null };

    const userData = result[0];
    const notificationsWithStockData = userData.specialNotification.map(notification => ({
      ...notification,
      stockInfo: userData.stockData.find(s => s._id.toString() === notification.stockId.toString()) || null
    }));

    return {
      status: 200, message: 'Special notifications fetched successfully',
      data: { user: { _id: userData._id, name: userData.name, email: userData.email, uniqueCode: userData.uniqueCode }, notifications: notificationsWithStockData, totalNotifications: notificationsWithStockData.length }
    };
  } catch (error) {
    console.error('[NotificationPush] fetchSpecialNotification:', error);
    return { status: 500, message: 'Error fetching push notifications', data: null };
  }
};

/**
 * Deletes a special notification from a user's record.
 * @param {string} notificationId
 * @returns {Promise}
 */
const deleteNotification = async (notificationId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return { status: 400, success: false, message: 'Invalid notification ID format' };

    const result = await User.updateOne(
      { 'specialNotification._id': notificationId },
      { $pull: { specialNotification: { _id: notificationId } } }
    );

    if (result.modifiedCount === 0) return { status: 404, success: false, message: 'Notification not found' };

    return { status: 200, success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    console.error('[NotificationPush] deleteNotification:', error);
    return { status: 500, success: false, message: 'Internal server error', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch (WebSocket + FCM)
// ─────────────────────────────────────────────────────────────────────────────

const _storeSpecialNotification = async (uniqueCode, notificationData) => {
  const user = await User.findOne({ uniqueCode });
  if (!user) throw new Error('User not found');

  user.specialNotification.push({
    title:       notificationData.title,
    description: notificationData.description || notificationData.message,
    time:        new Date(notificationData.time || Date.now()),
    priority:    notificationData.priority || 'medium',
    stockId:     notificationData.stockId,
  });

  if (user.specialNotification.length > 100) user.specialNotification = user.specialNotification.slice(-100);
  user.updatedAt = new Date();
  await user.save();
};

const _dispatchToUser = async (uniqueCode, notificationData) => { 
  console.log(`[NotificationPush] Dispatching notification to user ${uniqueCode}:`, notificationData);
  const results = { websocket: { success: false }, pushNotification: { success: false } };

  try {
    if (global.io) {
      global.io.to(`user_${uniqueCode}`).emit('new_notification', {
        ...notificationData,
        meta: { targetUser: uniqueCode, sentAt: new Date().toISOString() },
      });
      results.websocket = { success: true };
    }
  } catch (error) {
    results.websocket = { success: false, error: error.message };
  }

  try {
    results.pushNotification = await tokenService.sendNotificationToUser(uniqueCode, notificationData);
    const verdict = await sendVoipSyncPush(uniqueCode, notificationData._id || notificationData.notificationId).catch(() => {})
    console.log(`[NotificationPush] sendVoipSyncPush verdict for ${uniqueCode}:`, verdict);
  } catch (error) {
    results.pushNotification = { success: false, error: error.message };
  }

  try {
    const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
    if (user?.webPushSubscription) {
      await webpush.sendNotification(
        user.webPushSubscription,
        JSON.stringify({ title: notificationData.title, description: notificationData.description || notificationData.message })
      );
    }
  } catch (err) {
    if (err.statusCode === 410) {
      await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: null } });
    }
  }

  if (notificationData.type === 'special') {
    try { await _storeSpecialNotification(uniqueCode, notificationData); } catch (_) {}
  }

  const overallSuccess = results.websocket.success || results.pushNotification.success;
  return { success: overallSuccess, message: overallSuccess ? 'Notification sent successfully' : 'Failed to send notification', data: results };
};

const _dispatchBroadcast = async (notificationData) => {
  console.log('[NotificationPush] Broadcasting notification:', notificationData);
  const results = { websocket: { success: false }, pushNotification: { success: false } };

  try {
    if (global.io) {
      global.io.emit('new_notification', notificationData);
      results.websocket = { success: true };
    }
  } catch (error) {
    results.websocket = { success: false, error: error.message };
  }

  try {
    const allUsers = await User.find({ isActive: true }).select('uniqueCode');
    const uniqueCodes = allUsers.map(u => u.uniqueCode);
    if (uniqueCodes.length > 0) {
      // Dispatch per-user so each user receives websocket + FCM + VoIP sync
      const perUserDispatch = await _dispatchToUsers(uniqueCodes, notificationData);
      // Merge per-user results into broadcast results
      results.pushNotification = perUserDispatch.data ? perUserDispatch.data.pushNotification : { success: false };
      results.details = perUserDispatch.data ? perUserDispatch.data.details : [];
      results.voip = perUserDispatch.data ? perUserDispatch.data.details.map(d => ({ uniqueCode: d.uniqueCode, voip: d.voip })) : [];
    }
  } catch (error) {
    results.pushNotification = { success: false, error: error.message };
  }

  const overallSuccess = results.websocket.success || results.pushNotification.success;
  return { success: overallSuccess, message: overallSuccess ? 'Broadcast sent successfully' : 'Failed to send broadcast', data: results };
};

const _dispatchToUsers = async (uniqueCodes, notificationData) => {
  console.log(`[NotificationPush] Dispatching notification to multiple users: ${uniqueCodes.join(', ')}`, notificationData);
  if (!Array.isArray(uniqueCodes) || uniqueCodes.length === 0) return { success: false, message: 'No user IDs provided' };

  const results = { websocket: { success: 0, failed: 0 }, pushNotification: { success: 0, failed: 0 }, details: [] };

  await Promise.all(uniqueCodes.map(async (uniqueCode) => {
    const userResult = { uniqueCode, websocket: { success: false }, pushNotification: { success: false } };

    try {
      if (global.io) {
        global.io.to(`user_${uniqueCode}`).emit('new_notification', {
          ...notificationData,
          meta: { targetUser: uniqueCode, sentAt: new Date().toISOString() },
        });
        userResult.websocket = { success: true };
        results.websocket.success++;
      }
    } catch (error) {
      userResult.websocket = { success: false, error: error.message };
      results.websocket.failed++;
    }

    try { 
      const pushResult = await tokenService.sendNotificationToUser(uniqueCode, notificationData);
      userResult.pushNotification = pushResult;
      pushResult.success ? results.pushNotification.success++ : results.pushNotification.failed++;
    } catch (error) {
      userResult.pushNotification = { success: false, error: error.message };
      results.pushNotification.failed++;
    }

    try {
      if (Array.isArray(uniqueCode)) {
        // Defensive: if uniqueCode is unexpectedly an array, send VoIP sync to each
        const voipResults = await Promise.all(uniqueCode.map(code => sendVoipSyncPush(code, notificationData._id || notificationData.notificationId).catch(() => ({ success: false }))));
        userResult.voip = voipResults;
      } else {
        const voipVerdict = await sendVoipSyncPush(uniqueCode, notificationData._id || notificationData.notificationId).catch(() => ({ success: false }));
        userResult.voip = voipVerdict;
      }
    } catch (err) {
      userResult.voip = { success: false, error: err.message };
    }

    try {
      const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
      if (user?.webPushSubscription) {
        await webpush.sendNotification(
          user.webPushSubscription,
          JSON.stringify({ title: notificationData.title, description: notificationData.description || notificationData.message })
        );
      }
    } catch (err) {
      if (err.statusCode === 410) {
        await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: null } });
      }
    }

    if (notificationData.type === 'special') {
      try { await _storeSpecialNotification(uniqueCode, notificationData); } catch (_) {}
    }

    results.details.push(userResult);
  }));

  const overallSuccess = results.websocket.success > 0 || results.pushNotification.success > 0;
  console.log(`Dispatched notification to ${uniqueCodes.length} users. WebSocket success: ${results.websocket.success}, Push success: ${results.pushNotification.success}`);
  return { success: overallSuccess, message: overallSuccess ? 'Notifications sent' : 'Failed to send notifications', data: results };
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

class PushNotificationService {
  static sendNotificationToUser  = (uniqueCode, data)        => _dispatchToUser(uniqueCode, data);
  static broadcastNotification   = (data)                    => _dispatchBroadcast(data);
  static sendNotificationToUsers = (uniqueCodes, data)       => _dispatchToUsers(uniqueCodes, data);
  static dismissNotification     = dismissNotification;
  static sendVoIPCallNotification = sendVoIPCallNotification;

  static async sendGeneralNotification(uniqueCode, title, description, priority = 'medium', type = 'normal', notificationId, extraData = {}) {
    return 0;
    // const notification = {
    //   _id: notificationId,
    //   type,
    //   title,
    //   description,
    //   message: description,
    //   priority,
    //   time: new Date().toISOString(),
    //   notificationId,
    //   ...extraData,
    // };
    // console.log(`Sending general notification to ${uniqueCode || 'broadcast'}:`, notification);
    // if (Array.isArray(uniqueCode)) return _dispatchToUsers(uniqueCode, notification);
    // if (uniqueCode)                return _dispatchToUser(uniqueCode, notification);
    // return _dispatchBroadcast(notification);
  }

  static async sendStockAlert(uniqueCode, stockInfo, message) {
    const notification = { _id: `stock_${stockInfo._id}_${Date.now()}`, type: 'special', stockId: stockInfo._id, title: `Stock Alert: ${stockInfo.product}`, message: message || `Stock update for ${stockInfo.product}`, description: message || `Stock update for ${stockInfo.product}`, priority: stockInfo.stockCount < 10 ? 'high' : 'medium', time: new Date().toISOString(), stockInfo };
    if (Array.isArray(uniqueCode)) return _dispatchToUsers(uniqueCode, notification);
    if (uniqueCode)                return _dispatchToUser(uniqueCode, notification);
    return _dispatchBroadcast(notification);
  }

  static async sendEquipmentAlert(uniqueCode, equipmentInfo, message) {
    const notification = { _id: `equipment_${equipmentInfo._id}_${Date.now()}`, type: 'special', stockId: equipmentInfo._id, title: `Equipment Alert: ${equipmentInfo.equipmentName || equipmentInfo.product}`, message: message || `Equipment update for ${equipmentInfo.equipmentName || equipmentInfo.product}`, description: message || `Equipment update for ${equipmentInfo.equipmentName || equipmentInfo.product}`, priority: 'high', time: new Date().toISOString(), stockInfo: { ...equipmentInfo, type: 'equipment' } };
    if (Array.isArray(uniqueCode)) return _dispatchToUsers(uniqueCode, notification);
    if (uniqueCode)                return _dispatchToUser(uniqueCode, notification);
    return _dispatchBroadcast(notification);
  }

  static async sendMaintenanceReminder(uniqueCode, maintenanceInfo, message) {
    const notification = { _id: `maintenance_${maintenanceInfo._id}_${Date.now()}`, type: 'special', title: `Maintenance Reminder: ${maintenanceInfo.equipmentName || maintenanceInfo.title}`, message: message || `Scheduled maintenance for ${maintenanceInfo.equipmentName || maintenanceInfo.title}`, description: message || `Scheduled maintenance for ${maintenanceInfo.equipmentName || maintenanceInfo.title}`, priority: 'medium', time: new Date().toISOString(), maintenanceInfo };
    if (Array.isArray(uniqueCode)) return _dispatchToUsers(uniqueCode, notification);
    if (uniqueCode)                return _dispatchToUser(uniqueCode, notification);
    return _dispatchBroadcast(notification);
  }

  static async sendNotificationToRoles(roles, notificationData) {
    try {
      const users       = await User.find({ role: { $in: roles }, isActive: true }).select('uniqueCode');
      const uniqueCodes = users.map(u => u.uniqueCode);
      if (uniqueCodes.length === 0) return { success: false, message: 'No users found with specified roles' };
      return _dispatchToUsers(uniqueCodes, notificationData);
    } catch (error) {
      console.error('[NotificationPush] sendNotificationToRoles:', error);
      return { success: false, message: 'Failed to send notifications to roles', error: error.message };
    }
  }

  static async getNotificationStats() {
    try {
      const totalUsers      = await User.countDocuments({ isActive: true });
      const usersWithTokens = await User.countDocuments({ isActive: true, 'pushTokens.0': { $exists: true } });
      const users           = await User.find({ isActive: true }).select('pushTokens');
      const totalTokens     = users.reduce((count, u) => count + (u.pushTokens?.length || 0), 0);
      return { success: true, data: { totalUsers, usersWithTokens, totalTokens, coverage: totalUsers > 0 ? Math.round((usersWithTokens / totalUsers) * 100) : 0 } };
    } catch (error) {
      console.error('[NotificationPush] getNotificationStats:', error);
      return { success: false, message: 'Failed to get notification statistics', error: error.message };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = PushNotificationService;
module.exports.pushSpecialNotification  = pushSpecialNotification;
module.exports.fetchSpecialNotification = fetchSpecialNotification;
module.exports.deleteNotification       = deleteNotification;
module.exports.sendVoipSyncPush         = sendVoipSyncPush;