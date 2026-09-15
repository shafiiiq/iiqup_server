// notification.service.js
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status')
const Notification = require('./notification.model');
const mongoose = require('mongoose');
const { paginate } = require('#shared/pagination/pagination')
const { SEVEN_DAYS_MS } = require('./notification.constant');

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
      priority: priority || 'medium',
      sourceId,
      time: time || new Date(),
      navigateTo,
      navigateText,
      navigteToId,
      hasButton: hasButton || false,
      directApproval: directApproval || false,
      approvalPort,
      type,
      category: category || 'general',
      targetUsers,
      forYou: forYou || [],
      isBroadcast,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await notification.save();

    return { success: true, data: notification };
  } catch (error) {
    logger.error('[notification.service] createNotification', error);
    return { success: false, error: error.message };
  }
};

const createBulkNotifications = async (notificationsArray) => {
  try {
    const notifications = notificationsArray.map((data) => ({
      title: data.title,
      description: data.description,
      time: data.time || new Date(),
      priority: data.priority,
      sourceId: data.sourceId,
      updatedAt: new Date(),
    }));

    const savedNotifications = await Notification.insertMany(notifications);

    return {
      success: true,
      data: savedNotifications,
      count: savedNotifications.length,
      message: 'Bulk notifications created successfully',
    };
  } catch (error) {
    logger.error('[notification.service] createBulkNotifications', error);
    return { success: false, error: error.message, message: 'Failed to create bulk notifications' };
  }
};

const quickNotification = async (title, sourceId, options = {}) => {
  return createNotification({
    title,
    sourceId,
    description: options.description || { message: title },
    priority: options.priority || 'medium',
    time: options.time || new Date(),
  });
};

const buildVisibilityQuery = (uniqueCode) => ({
  $or: [
    { isBroadcast: true },
    { targetUsers: uniqueCode },
    { forYou: uniqueCode },
    { visibleTo: uniqueCode },
    {
      $and: [
        { isBroadcast: false },
        { targetUsers: { $size: 0 } },
        { forYou: { $size: 0 } },
        { visibleTo: { $size: 0 } },
      ],
    },
  ],
});

const buildUserSpecificQuery = (uniqueCode) => ({
  $or: [{ targetUsers: uniqueCode }, { visibleTo: uniqueCode }],
});

const getNotificationStatsService = async (uniqueCode) => {
  try {
    const visibilityQuery = buildVisibilityQuery(uniqueCode);

    const [total, unread, forYouUnread] = await Promise.all([
      Notification.countDocuments(visibilityQuery),
      Notification.countDocuments({ ...visibilityQuery, 'readBy.uniqueCode': { $ne: uniqueCode } }),
      Notification.countDocuments({ ...visibilityQuery, forYou: uniqueCode, 'readBy.uniqueCode': { $ne: uniqueCode } }),
    ]);

    return { total, unread, forYouUnread };
  } catch (error) {
    logger.error('[notification.service] getNotificationStatsService', error);
    throw error;
  }
};

const getAllNotificationsService = async (uniqueCode, pagination = { page: 1, limit: HTTP.OK, skip: 0 }) => {
  try {
    const query = buildVisibilityQuery(uniqueCode);
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getAllNotificationsService', error);
    throw new Error('Failed to retrieve notifications from database');
  }
};

const getUnreadNotificationsService = async (uniqueCode, pagination = { page: 1, limit: 100, skip: 0 }) => {
  try {
    const query = { 'readBy.uniqueCode': { $ne: uniqueCode }, $and: [buildVisibilityQuery(uniqueCode)] };
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getUnreadNotificationsService', error);
    throw error;
  }
};

const getForYouNotificationsService = async (uniqueCode, pagination = { page: 1, limit: 100, skip: 0 }) => {
  try {
    const query = { forYou: uniqueCode };
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getForYouNotificationsService', error);
    throw error;
  }
};

const getHighPriorityNotificationsService = async (uniqueCode, pagination = { page: 1, limit: 100, skip: 0 }) => {
  try {
    const query = {
      sourceId: { $ne: 'attendance' },
      priority: 'high',
      $and: [buildVisibilityQuery(uniqueCode)],
    };
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getHighPriorityNotificationsService', error);
    throw error;
  }
};

const getUserSpecificNotificationsService = async (uniqueCode, sourceId, pagination = { page: 1, limit: 100, skip: 0 }) => {
  try {
    const query = buildUserSpecificQuery(uniqueCode);
    if (sourceId) query.sourceId = sourceId;
    return paginate(Notification, query, pagination, { sort: { sourceId: 1, createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getUserSpecificNotificationsService', error);
    throw error;
  }
};

const getCategoryNotificationsService = async (uniqueCode, category, pagination = { page: 1, limit: 100, skip: 0 }) => {
  try {
    const query = { category, $and: [buildVisibilityQuery(uniqueCode)] };
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] getCategoryNotificationsService', error);
    throw error;
  }
};

const formatUserSpecificTabLabel = (sourceId) => {
  if (!sourceId) return 'General';
  if (mongoose.Types.ObjectId.isValid(sourceId)) return `Related Item (${sourceId.slice(-4)})`;

  const knownLabels = {
    purchaseorder_approval: 'PurchaseOrder Approval',
    manager_approval: 'Manager Approval',
    accounts_approval: 'Accounts Approval',
    work_completed: 'Work Completed',
    mechanic_request: 'Mechanic Request',
    backcharge_approval: 'Backcharge Approval',
    attendance: 'Attendance',
    chat: 'Chat',
    'from applications': 'Application',
  };

  if (knownLabels[sourceId]) return knownLabels[sourceId];

  return sourceId.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const getUserSpecificTabsService = async (uniqueCode) => {
  try {
    const groups = await Notification.aggregate([
      { $match: { $or: [{ targetUsers: uniqueCode }, { visibleTo: uniqueCode }] } },
      { $group: { _id: '$sourceId' } },
      { $project: { sourceId: '$_id', _id: 0 } },
    ]);

    return groups
      .map((g) => ({ id: g.sourceId, label: formatUserSpecificTabLabel(g.sourceId) }))
      .filter((tab) => tab.id);
  } catch (error) {
    logger.error('[notification.service] getUserSpecificTabsService', error);
    throw error;
  }
};

const getModelCategoriesService = async (uniqueCode) => {
  try {
    const groups = await Notification.aggregate([
      { $match: { $and: [buildVisibilityQuery(uniqueCode), { category: { $nin: ['general', null, ''] } }] } },
      { $group: { _id: '$category' } },
      { $project: { category: '$_id', _id: 0 } },
    ]);
    return groups.map((g) => g.category).filter(Boolean);
  } catch (error) {
    logger.error('[notification.service] getModelCategoriesService', error);
    throw error;
  }
};

const searchNotificationsService = async (
  uniqueCode,
  searchTerm,
  filter = 'all',
  category = 'all',
  pagination = { page: 1, limit: 50, skip: 0 }
) => {
  try {
    const textMatch = {
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { 'description.message': { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ],
    };

    let scopeQuery = {};
    switch (filter) {
      case 'unread':
        scopeQuery = { 'readBy.uniqueCode': { $ne: uniqueCode }, $and: [buildVisibilityQuery(uniqueCode)] };
        break;
      case 'foryou':
        scopeQuery = { forYou: uniqueCode };
        break;
      case 'high':
        scopeQuery = { priority: 'high', $and: [buildVisibilityQuery(uniqueCode)] };
        break;
      case 'user_specific':
        scopeQuery = buildUserSpecificQuery(uniqueCode);
        break;
      default:
        scopeQuery = { $and: [buildVisibilityQuery(uniqueCode)] };
    }

    if (category !== 'all') scopeQuery.category = category;

    const query = { $and: [scopeQuery, textMatch] };
    return paginate(Notification, query, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[notification.service] searchNotificationsService', error);
    throw error;
  }
};

const getPendingNotifications = async (uniqueCode, since, limit = 100) => {
  try {
    if (!uniqueCode) throw new Error('uniqueCode is required');

    const fetchFromDate = new Date(Date.now() - SEVEN_DAYS_MS);

    const notifications = await Notification.find({
      createdAt: { $gte: fetchFromDate },
      $or: [{ isBroadcast: true }, { targetUsers: uniqueCode }],
      'deliveredTo.uniqueCode': { $ne: uniqueCode },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const formatted = notifications.map((n) => ({
      ...n,
      type: 'normal',
      _id: n._id.toString(),
      time: n.createdAt || n.time,
    }));

    return {
      notifications: formatted,
      meta: {
        total: formatted.length,
        since: fetchFromDate.toISOString(),
        normalCount: formatted.length,
      },
    };
  } catch (error) {
    logger.error('[notification.service] getPendingNotifications', error);
    throw error;
  }
};

const markNotificationAsRead = async (notificationId, uniqueCode) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      logger.warn('[notification.service] markNotificationAsRead', notificationId);
      return { success: false, message: 'Invalid notification ID' };
    }

    const result = await Notification.findByIdAndUpdate(
      notificationId,
      { $addToSet: { readBy: { uniqueCode, readAt: new Date() } } },
      { new: true }
    );

    if (!result) return { success: false, message: 'Notification not found' };

    return { success: true, message: 'Marked as read' };
  } catch (error) {
    logger.error('[notification.service] markNotificationAsRead', error);
    throw error;
  }
};

const markNotificationAsDelivered = async (notificationId, uniqueCode) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      logger.warn('[notification.service] markNotificationAsDelivered', notificationId);
      return { success: false, message: 'Invalid notification ID' };
    }

    const result = await Notification.findByIdAndUpdate(
      notificationId,
      { $addToSet: { deliveredTo: { uniqueCode, deliveredAt: new Date() } } },
      { new: true }
    );

    if (!result) {
      logger.warn('[notification.service] markNotificationAsDelivered', notificationId);
      return { success: false, message: 'Notification not found' };
    }

    return { success: true, message: 'Marked as delivered' };
  } catch (error) {
    logger.error('[notification.service] markNotificationAsDelivered', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  quickNotification,
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
  markNotificationAsDelivered,
  markNotificationAsRead,
};