// push/notification.push.js
const admin          = require('../utils/firebase.utils');
const tokenService   = require('../services/token.service');
const { sendNotificationToUser: sendWebSocketNotification, broadcastNotification: broadcastWebSocketNotification } = require('../sockets/websocket').default;
const User     = require('../models/user.model');
const Operator = require('../models/operator.model');
const Mechanic = require('../models/mechanic.model');
const { default: mongoose } = require('mongoose');

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
  const results = { websocket: { success: false }, pushNotification: { success: false } };

  try {
    await sendWebSocketNotification(uniqueCode, notificationData);
    results.websocket = { success: true };
  } catch (error) {
    results.websocket = { success: false, error: error.message };
  }

  try {
    results.pushNotification = await tokenService.sendNotificationToUser(uniqueCode, notificationData);
  } catch (error) {
    results.pushNotification = { success: false, error: error.message };
  }

  if (notificationData.type === 'special') {
    try { await _storeSpecialNotification(uniqueCode, notificationData); } catch (_) {}
  }

  const overallSuccess = results.websocket.success || results.pushNotification.success;
  return { success: overallSuccess, message: overallSuccess ? 'Notification sent successfully' : 'Failed to send notification', data: results };
};

const _dispatchBroadcast = async (notificationData) => {
  const results = { websocket: { success: false }, pushNotification: { success: false } };

  try {
    broadcastWebSocketNotification(notificationData);
    results.websocket = { success: true };
  } catch (error) {
    results.websocket = { success: false, error: error.message };
  }

  try {
    const allUsers    = await User.find({ isActive: true }).select('uniqueCode');
    const uniqueCodes = allUsers.map(u => u.uniqueCode);
    if (uniqueCodes.length > 0) results.pushNotification = await tokenService.sendBulkNotifications(uniqueCodes, notificationData);
  } catch (error) {
    results.pushNotification = { success: false, error: error.message };
  }

  const overallSuccess = results.websocket.success || results.pushNotification.success;
  return { success: overallSuccess, message: overallSuccess ? 'Broadcast sent successfully' : 'Failed to send broadcast', data: results };
};

const _dispatchToUsers = async (uniqueCodes, notificationData) => {
  if (!Array.isArray(uniqueCodes) || uniqueCodes.length === 0) return { success: false, message: 'No user IDs provided' };

  const results = { websocket: { success: 0, failed: 0 }, pushNotification: { success: 0, failed: 0 }, details: [] };

  await Promise.all(uniqueCodes.map(async (uniqueCode) => {
    const userResult = { uniqueCode, websocket: { success: false }, pushNotification: { success: false } };

    try {
      sendWebSocketNotification(uniqueCode, notificationData);
      userResult.websocket = { success: true };
      results.websocket.success++;
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

    if (notificationData.type === 'special') {
      try { await _storeSpecialNotification(uniqueCode, notificationData); } catch (_) {}
    }

    results.details.push(userResult);
  }));

  const overallSuccess = results.websocket.success > 0 || results.pushNotification.success > 0;
  return { success: overallSuccess, message: overallSuccess ? `Notifications sent to ${results.websocket.success + results.pushNotification.success} users` : 'Failed to send notifications', data: results };
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

  static async sendGeneralNotification(uniqueCode, title, description, priority = 'medium', type = 'normal', notificationId) {
    const notification = { _id: notificationId, type, title, description, message: description, priority, time: new Date().toISOString(), notificationId };
    if (Array.isArray(uniqueCode)) return _dispatchToUsers(uniqueCode, notification);
    if (uniqueCode)                return _dispatchToUser(uniqueCode, notification);
    return _dispatchBroadcast(notification);
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