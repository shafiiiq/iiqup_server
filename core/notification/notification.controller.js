const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const notificationsService = require('./notification.service');
const notificationToken = require('./notification.token');
const PushNotificationService = require('./notification.push');

const getAuthenticatedUniqueCode = (req) => req.user?.uniqueCode;

const getAllNotifications = async (req, res) => {
  try {
    const { uniqueCode } = req.user;
    const result = await notificationsService.getAllNotificationsService(uniqueCode, req.pagination);

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getAllNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const stats = await notificationsService.getNotificationStatsService(uniqueCode);
    sendSuccess(res, { status: HTTP.OK, message: 'Stats retrieved successfully', data: stats });
  } catch (error) {
    logger.error('[notification.controller] getNotificationStats', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.markNotificationAsRead(id, uniqueCode);
    sendSuccess(res, { status: HTTP.OK, message: result.message });
  } catch (error) {
    logger.error('[notification.controller] markAsRead', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUnreadNotifications = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.getUnreadNotificationsService(uniqueCode, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Unread notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getUnreadNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getForYouNotifications = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.getForYouNotificationsService(uniqueCode, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'For you notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getForYouNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getHighPriorityNotifications = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.getHighPriorityNotificationsService(uniqueCode, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'High priority notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getHighPriorityNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUserSpecificNotifications = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    const { sourceId } = req.query;
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.getUserSpecificNotificationsService(uniqueCode, sourceId, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'User specific notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getUserSpecificNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUserSpecificTabs = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const tabs = await notificationsService.getUserSpecificTabsService(uniqueCode);
    sendSuccess(res, { status: HTTP.OK, message: 'User specific tabs retrieved successfully', data: tabs });
  } catch (error) {
    logger.error('[notification.controller] getUserSpecificTabs', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getModelCategories = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    if (!uniqueCode) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const categories = await notificationsService.getModelCategoriesService(uniqueCode);
    sendSuccess(res, { status: HTTP.OK, message: 'Model categories retrieved successfully', data: categories });
  } catch (error) {
    logger.error('[notification.controller] getModelCategories', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getCategoryNotifications = async (req, res) => {
  try {
    const uniqueCode = getAuthenticatedUniqueCode(req);
    const { category } = req.query;
    if (!uniqueCode || !category) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode and category are required' });
    }

    const result = await notificationsService.getCategoryNotificationsService(uniqueCode, category, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Category notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] getCategoryNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const searchNotifications = async (req, res) => {
  try {
    const { uniqueCode, searchTerm, filter = 'all', category = 'all' } = req.body;
    if (!uniqueCode || !searchTerm) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode and searchTerm are required' });
    }

    const result = await notificationsService.searchNotificationsService(uniqueCode, searchTerm, filter, category, req.pagination);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Search results retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[notification.controller] searchNotifications', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const dispatchFetchedNotifications = async (notifications, fallbackUniqueCode) => {
  const dispatches = notifications.map((notif) => {
    const title = notif.title || notif.message || '';
    const description =
      notif.description && typeof notif.description === 'object'
        ? notif.description.message || JSON.stringify(notif.description)
        : notif.description || notif.message || '';
    const priority = notif.priority || 'medium';
    const type = notif.type || 'normal';
    const id = notif._id;

    if (notif.isBroadcast) {
      return PushNotificationService.sendGeneralNotification(null, title, description, priority, type, id);
    }
    if (Array.isArray(notif.targetUsers) && notif.targetUsers.length > 0) {
      return PushNotificationService.sendGeneralNotification(notif.targetUsers, title, description, priority, type, id);
    }
    return PushNotificationService.sendGeneralNotification(fallbackUniqueCode, title, description, priority, type, id);
  });

  return Promise.allSettled(dispatches);
};

const getPendingNotifications = async (req, res) => {
  try {
    const { uniqueCode, since, limit = 100 } = req.body;

    if (!uniqueCode) {
      return sendError(res, { success: false, error: 'uniqueCode is required' });
    }

    const result = await notificationsService.getPendingNotifications(uniqueCode, since, limit);

    try {
      await dispatchFetchedNotifications(result.notifications, uniqueCode);
    } catch (err) {
      logger.error('[notification.controller] getPendingNotifications', err);
    }

    sendSuccess(res, { success: true, notifications: result.notifications, meta: result.meta });
  } catch (error) {
    logger.error('[notification.controller] getPendingNotifications', error);
    sendError(res, { success: false, error: 'Failed to fetch pending notifications', message: error.message });
  }
};

const markNotificationAsDelivered = async (req, res) => {
  try {
    const { notificationId, uniqueCode } = req.body;
    if (!notificationId || !uniqueCode) {
      return sendError(res, { success: false, error: 'notificationId and uniqueCode are required' });
    }

    const result = await notificationsService.markNotificationAsDelivered(notificationId, uniqueCode);
    if (!result.success) {
      return sendError(res, result);
    }

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[notification.controller] markNotificationAsDelivered', error);
    sendError(res, { success: false, error: error.message });
  }
};

const getUserPushTokens = async (req, res) => {
  try {
    const { uniqueCode } = req.query;
    if (!uniqueCode) {
      return sendError(res, { success: false, message: 'uniqueCode is required' });
    }

    const result = await notificationToken.getUserPushTokens(uniqueCode);
    if (!result.success) return sendError(res, result);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[notification.controller] getUserPushTokens', error);
    sendError(res, { success: false, message: error.message });
  }
};

const insertPushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken, platform } = req.body;
    if (!uniqueCode || !pushToken) {
      return sendError(res, { success: false, message: 'uniqueCode and pushToken are required' });
    }
    if (platform && !['ios', 'android'].includes(platform)) {
      return sendError(res, { success: false, message: 'Platform must be either ios or android' });
    }

    const result = await notificationToken.insertPushToken(uniqueCode, pushToken, platform);
    if (!result.success) return sendError(res, result);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[notification.controller] insertPushToken', error);
    sendError(res, { success: false, message: error.message });
  }
};

const insertVoipToken = async (req, res) => {
  try {
    const { uniqueCode, voipToken } = req.body;
    if (!uniqueCode || !voipToken) {
      return sendError(res, { success: false, message: 'uniqueCode and voipToken are required' });
    }

    const result = await notificationToken.insertVoipToken(uniqueCode, voipToken);
    if (!result.success) return sendError(res, result);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[notification.controller] insertVoipToken', error);
    sendError(res, { success: false, message: error.message });
  }
};

const removePushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken } = req.body;
    if (!uniqueCode || !pushToken) {
      return sendError(res, { status: HTTP.BAD_REQUEST, message: 'uniqueCode and pushToken are required' });
    }

    const result = await notificationToken.removePushToken(uniqueCode, pushToken);
    if (!result.success) return sendError(res, result);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[notification.controller] removePushToken', error);
    sendError(res, { success: false, message: error.message });
  }
};

module.exports = {
  getAllNotifications,
  getNotificationStats,
  markAsRead,
  getUnreadNotifications,
  getForYouNotifications,
  getHighPriorityNotifications,
  getUserSpecificNotifications,
  getCategoryNotifications,
  getUserSpecificTabs,
  getModelCategories,
  searchNotifications,
  getPendingNotifications,
  markNotificationAsDelivered,
  getUserPushTokens,
  insertPushToken,
  insertVoipToken,
  removePushToken,
};