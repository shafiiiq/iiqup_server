// services/notification.service.js
const Notification = require('../models/notification.model');
const User         = require('../models/user.model');
const mongoose     = require('mongoose');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { SEVEN_DAYS_MS } = require('../constants/notification.constants');

// ─────────────────────────────────────────────────────────────────────────────
// Write Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and stores a new notification.
 * Supports single user, multiple users, or broadcast (null recipient) targeting.
 *
 * @param {Object}          notificationData
 * @param {string}          notificationData.title         - Notification title.
 * @param {string|Object}   notificationData.description   - Notification description.
 * @param {string}          notificationData.priority      - Priority level ('high' | 'medium' | 'low').
 * @param {string}          notificationData.sourceId      - Source identifier (required).
 * @param {string|string[]|null} notificationData.recipient - Target uniqueCode(s), or null for broadcast.
 * @param {Date}            [notificationData.time]        - Notification time (defaults to now).
 * @param {string}          [notificationData.navigateTo]
 * @param {string}          [notificationData.navigateText]
 * @param {string}          [notificationData.navigteToId]
 * @param {boolean}         [notificationData.hasButton]
 * @param {boolean}         [notificationData.directApproval]
 * @param {string}          [notificationData.approvalPort]
 * @param {string}          [notificationData.type]        - Notification type (default: 'normal').
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
const createNotification = async (notificationData) => {
  try {
    const {
      title,
      description,
      priority,
      sourceId,
      recipient,
      forYou,
      time,
      navigateTo,
      navigateText,
      navigteToId,
      hasButton,
      directApproval,
      approvalPort,
      category,
      type = 'normal',
    } = notificationData;

    let targetUsers = [];
    let isBroadcast = false;

    if (recipient === null || recipient === undefined) {
      isBroadcast = true;
    } else if (Array.isArray(recipient)) {
      targetUsers = recipient;
    } else {
      targetUsers = [recipient];
    }

    const notification = new Notification({
      title,
      description,
      priority:      priority || 'medium',
      sourceId,
      time:          time || new Date(),
      navigateTo,
      navigateText,
      navigteToId,
      hasButton:     hasButton     || false,
      directApproval: directApproval || false,
      approvalPort,
      type,
      category: category || 'general',
      targetUsers,
      forYou: forYou || [],
      isBroadcast,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    });

    await notification.save();

    return { success: true, data: notification };
  } catch (error) {
    console.error('[NotificationService] createNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Creates multiple notifications in a single bulk insert.
 *
 * @param {Object[]} notificationsArray - Array of notification data objects.
 * @returns {Promise<{ success: boolean, data?: Object[], count?: number, message: string, error?: string }>}
 */
const createBulkNotifications = async (notificationsArray) => {
  try {
    const notifications = notificationsArray.map(data => ({
      title:       data.title,
      description: data.description,
      time:        data.time || new Date(),
      priority:    data.priority,
      sourceId:    data.sourceId,
      updatedAt:   new Date(),
    }));

    const savedNotifications = await Notification.insertMany(notifications);

    return {
      success: true,
      data:    savedNotifications,
      count:   savedNotifications.length,
      message: 'Bulk notifications created successfully',
    };
  } catch (error) {
    console.error('[NotificationService] createBulkNotifications:', error);
    return {
      success: false,
      error:   error.message,
      message: 'Failed to create bulk notifications',
    };
  }
};

/**
 * Quick helper for creating a notification with minimal required data.
 *
 * @param {string} title    - Notification title.
 * @param {string} sourceId - Source identifier.
 * @param {Object} [options]
 * @returns {Promise<Object>} Created notification result.
 */
const quickNotification = async (title, sourceId, options = {}) => {
  return await createNotification({
    title,
    sourceId,
    description: options.description || { message: title },
    priority:    options.priority    || 'medium',
    time:        options.time        || new Date(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Read Operations
// ─────────────────────────────────────────────────────────────────────────────

const getNotificationStatsService = async (uniqueCode) => {
  try {
    const visibleToFilter = {
      $or: [
        { visibleTo: { $exists: false } },
        { visibleTo: { $size: 0 } },
        { visibleTo: uniqueCode },
      ],
    }

    const [total, unread, forYouUnread] = await Promise.all([
      Notification.countDocuments({ ...visibleToFilter }),
      Notification.countDocuments({ ...visibleToFilter, 'readBy.uniqueCode': { $ne: uniqueCode } }),
      Notification.countDocuments({ forYou: uniqueCode, 'readBy.uniqueCode': { $ne: uniqueCode } }),
    ])

    return { total, unread, forYouUnread }
  } catch (error) {
    console.error('[NotificationService] getNotificationStatsService:', error)
    throw error
  }
}

/**
 * Returns a paginated list of all notifications.
 * Roles outside ALLOWED_ROLES are excluded from seeing attendance notifications.
 *
 * @param {string} uniqueCode - Caller's unique code (used for role-based filtering).
 * @param {number} [page=1]
 * @param {number} [limit=200]
 * @returns {Promise<{ notifications: Object[], currentPage: number, totalPages: number, totalCount: number, hasNextPage: boolean }>}
 */
const getAllNotificationsService = async (uniqueCode, page = 1, limit = 200) => {
  try {
    const query = {
      $or: [
        { visibleTo: { $exists: false } },
        { visibleTo: { $size: 0 } },
        { visibleTo: uniqueCode },
      ],
    }

    const skip       = (page - 1) * limit
    const totalCount = await Notification.countDocuments(query)
    const totalPages = Math.ceil(totalCount / limit)

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    return {
      notifications,
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
    }
  } catch (error) {
    console.error('[NotificationService] getAllNotificationsService:', error)
    throw new Error('Failed to retrieve notifications from database')
  }
}

const getUnreadNotificationsService = async (uniqueCode, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = {
      'readBy.uniqueCode': { $ne: uniqueCode },
      $and: [
        { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] },
      ],
    }    
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getUnreadNotificationsService:', error)
    throw error
  }
}

const getForYouNotificationsService = async (uniqueCode, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = {
      forYou: uniqueCode,
      $and: [
        { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] },
      ],
    }
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getForYouNotificationsService:', error)
    throw error
  }
}

const getNormalNotificationsService = async (uniqueCode, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = {
      priority: 'high',
      $and: [
        { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] },
      ],
    }
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getNormalNotificationsService:', error)
    throw error
  }
}

const getHighPriorityNotificationsService = async (uniqueCode, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = {
      sourceId: { $ne: 'attendance' },
      priority: 'high',
      $or: [{ isBroadcast: true }, { targetUsers: uniqueCode }],
      $and: [
        { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] },
      ],
    }
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getHighPriorityNotificationsService:', error)
    throw error
  }
}

const getUserSpecificNotificationsService = async (uniqueCode, sourceId, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = { visibleTo: uniqueCode }
    if (sourceId) query.sourceId = sourceId
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ sourceId: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getUserSpecificNotificationsService:', error)
    throw error
  }
}

const getCategoryNotificationsService = async (uniqueCode, category, page = 1, limit = 100) => {
  try {
    const skip = (page - 1) * limit
    const query = {
      category,
      $or: [{ isBroadcast: true }, { targetUsers: uniqueCode }],
      $and: [
        { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] },
      ],
    }
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] getCategoryNotificationsService:', error)
    throw error
  }
}

const getUserSpecificTabsService = async (uniqueCode) => {
  try {
    const groups = await Notification.aggregate([
      { $match: { visibleTo: uniqueCode } },
      { $group: { _id: '$sourceId', label: { $first: '$sourceId' } } },
      { $project: { sourceId: '$_id', _id: 0 } },
    ])
    return groups.map(g => g.sourceId).filter(Boolean)
  } catch (error) {
    console.error('[NotificationService] getUserSpecificTabsService:', error)
    throw error
  }
}

const getModelCategoriesService = async (uniqueCode) => {
  try {
    const visibleToFilter = {
      $or: [
        { visibleTo: { $exists: false } },
        { visibleTo: { $size: 0 } },
        { visibleTo: uniqueCode },
      ],
    }
    const groups = await Notification.aggregate([
      { $match: { ...visibleToFilter, category: { $nin: ['general', null, ''] } } },
      { $group: { _id: '$category' } },
      { $project: { category: '$_id', _id: 0 } },
    ])
    return groups.map(g => g.category).filter(Boolean)
  } catch (error) {
    console.error('[NotificationService] getModelCategoriesService:', error)
    throw error
  }
}

const searchNotificationsService = async (uniqueCode, searchTerm, filter = 'all', category = 'all', page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit
    const visibleToFilter = { $or: [{ visibleTo: { $exists: false } }, { visibleTo: { $size: 0 } }, { visibleTo: uniqueCode }] }
    const textMatch = {
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { 'description.message': { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ],
    }

    let scopeQuery = {}
    switch (filter) {
      case 'unread':
        scopeQuery = { 'readBy.uniqueCode': { $ne: uniqueCode }, $and: [visibleToFilter] }
        break
      case 'foryou':
        scopeQuery = { forYou: uniqueCode, $and: [visibleToFilter] }
        break
      case 'high':
        scopeQuery = { priority: 'high', $and: [visibleToFilter] }
        break
      case 'user_specific':
        scopeQuery = { visibleTo: uniqueCode }
        break
      default:
        scopeQuery = { $and: [visibleToFilter] }
    }

    if (category !== 'all') {
      scopeQuery.category = category
    }

    const query = { $and: [scopeQuery, textMatch] }
    const totalCount = await Notification.countDocuments(query)
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    return {
      notifications,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
    }
  } catch (error) {
    console.error('[NotificationService] searchNotificationsService:', error)
    throw error
  }
}

/**
 * Returns undelivered notifications for a given user from the past 7 days,
 * including both broadcast and user-targeted notifications.
 * Also merges in any special notifications stored on the user document.
 *
 * @param {string} uniqueCode - Recipient's unique code (required).
 * @param {Date}   [since]    - Unused; kept for API compatibility.
 * @param {number} [limit=100]
 * @returns {Promise<{ notifications: Object[], meta: Object }>}
 */
const getPendingNotifications = async (uniqueCode, since, limit = 100) => {
  try {
    if (!uniqueCode) throw new Error('uniqueCode is required');

    const fetchFromDate = new Date(Date.now() - SEVEN_DAYS_MS);

    const normalNotifications = await Notification.find({
      createdAt: { $gte: fetchFromDate },
      $or: [
        { isBroadcast: true },
        { targetUsers: uniqueCode },
      ],
      'deliveredTo.uniqueCode': { $ne: uniqueCode },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    console.log(`[NotificationService] getPendingNotifications — found ${normalNotifications.length} undelivered for ${uniqueCode}`);

    const user = await User.findOne({ uniqueCode }).select('specialNotification');

    const specialNotifications = (user?.specialNotification || []).filter(notif => {
      return new Date(notif.time || notif.createdAt) >= fetchFromDate;
    });

    const allNotifications = [
      ...normalNotifications.map(n => ({
        ...n,
        type: 'normal',
        _id:  n._id.toString(),
        time: n.createdAt || n.time,
      })),
      ...specialNotifications.map(n => ({
        ...n,
        type: 'special',
        _id:  n._id ? n._id.toString() : `special_${Date.now()}_${Math.random()}`,
        time: n.time || n.createdAt,
      })),
    ];

    allNotifications.sort((a, b) => new Date(b.time || b.createdAt) - new Date(a.time || a.createdAt));

    const limitedNotifications = allNotifications.slice(0, limit);

    console.log(`[NotificationService] getPendingNotifications — returning ${limitedNotifications.length} notifications`);

    return {
      notifications: limitedNotifications,
      meta: {
        total:         limitedNotifications.length,
        since:         fetchFromDate.toISOString(),
        normalCount:   normalNotifications.length,
        specialCount:  specialNotifications.length,
      },
    };
  } catch (error) {
    console.error('[NotificationService] getPendingNotifications:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Update Operations
// ─────────────────────────────────────────────────────────────────────────────

const markNotificationAsRead = async (notificationId, uniqueCode) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      console.warn(`[NotificationService] markNotificationAsRead — invalid notification id ${notificationId}`);
      return { success: false, message: 'Invalid notification ID' };
    }

    const result = await Notification.findByIdAndUpdate(
      notificationId,
      {
        $addToSet: {
          readBy: {
            uniqueCode,
            readAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!result) return { success: false, message: 'Notification not found' };

    return { success: true, message: 'Marked as read' };
  } catch (error) {
    console.error('[NotificationService] markNotificationAsRead:', error);
    throw error;
  }
};

/**
 * Marks a notification as delivered to a specific user.
 *
 * @param {string} notificationId - The notification's MongoDB _id.
 * @param {string} uniqueCode     - Recipient's unique code.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
const markNotificationAsDelivered = async (notificationId, uniqueCode) => {
  try {
    console.log(`[NotificationService] markNotificationAsDelivered — ${notificationId} → ${uniqueCode}`);

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      console.warn(`[NotificationService] markNotificationAsDelivered — invalid notification id ${notificationId}`);
      return { success: false, message: 'Invalid notification ID' };
    }

    const result = await Notification.findByIdAndUpdate(
      notificationId,
      {
        $addToSet: {
          deliveredTo: {
            uniqueCode,
            deliveredAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!result) {
      console.warn(`[NotificationService] markNotificationAsDelivered — notification ${notificationId} not found`);
      return { success: false, message: 'Notification not found' };
    }

    return { success: true, message: 'Marked as delivered' };
  } catch (error) {
    console.error('[NotificationService] markNotificationAsDelivered:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Write
  createNotification,
  createBulkNotifications,
  quickNotification,
  // Read
  getNotificationStatsService,
  getAllNotificationsService,
  getUnreadNotificationsService,
  getForYouNotificationsService,
  getHighPriorityNotificationsService,
  getUserSpecificNotificationsService,
  getCategoryNotificationsService,
  getUserSpecificTabsService,
  getModelCategoriesService,
  searchNotificationsService,
  getPendingNotifications,
  // Update
  markNotificationAsDelivered,
  markNotificationAsRead,
}