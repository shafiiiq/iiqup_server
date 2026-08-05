const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/notification.controller.js
const notificationsService = require('./notification.service');
const {
  sendNotificationToUser,
  broadcastNotification,
} = require('../../socket/socket');
const PushNotificationService = require('./notification.push');

// ─────────────────────────────────────────────────────────────────────────────
// Notification CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /get-all-notification
 * Returns all notifications for a user with pagination.
 */
const getAllNotifications = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    const result = await notificationsService.getAllNotificationsService(
      uniqueCode,
      req.pagination
    );

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getAllNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

/**
 * GET /stats
 * Returns notification statistics.
 */
const getNotificationStats = async (req, res) => {
  try {
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const stats =
      await notificationsService.getNotificationStatsService(uniqueCode);

    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Stats retrieved successfully',
      data: stats,
    });
  } catch (error) {
    logger.error('[Notification] getNotificationStats:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

/**
 * PUT /mark-read/:id
 * Marks a notification as read.
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.markNotificationAsRead(
      id,
      uniqueCode
    );

    sendSuccess(res, { status: HTTP.OK, message: result.message });
  } catch (error) {
    logger.error('[Notification] markAsRead:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

/**
 * DELETE /delete/:id
 * Deletes a notification by ID.
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await Notification.findByIdAndDelete(id);

    res
      .status(HTTP.OK)
      .json({ status: HTTP.OK, message: 'Notification deleted successfully' });
  } catch (error) {
    logger.error('[Notification] deleteNotification:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUnreadNotifications = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const result = await notificationsService.getUnreadNotificationsService(
      uniqueCode,
      req.pagination
    );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Unread notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getUnreadNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getForYouNotifications = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const result = await notificationsService.getForYouNotificationsService(
      uniqueCode,
      req.pagination
    );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'For you notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getForYouNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getHighPriorityNotifications = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const result =
      await notificationsService.getHighPriorityNotificationsService(
        uniqueCode,
        req.pagination
      );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'High priority notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getHighPriorityNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUserSpecificNotifications = async (req, res) => {
  try {
    const { uniqueCode, sourceId } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const result =
      await notificationsService.getUserSpecificNotificationsService(
        uniqueCode,
        sourceId,
        req.pagination
      );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'User specific notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getUserSpecificNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUserSpecificTabs = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const tabs =
      await notificationsService.getUserSpecificTabsService(uniqueCode);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'User specific tabs retrieved successfully',
      data: tabs,
    });
  } catch (error) {
    logger.error('[Notification] getUserSpecificTabs:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getModelCategories = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode is required' });
    const categories =
      await notificationsService.getModelCategoriesService(uniqueCode);
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Model categories retrieved successfully',
      data: categories,
    });
  } catch (error) {
    logger.error('[Notification] getModelCategories:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getCategoryNotifications = async (req, res) => {
  try {
    const { uniqueCode, category } = req.body;
    if (!uniqueCode || !category)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ status: HTTP.BAD_REQUEST, message: 'uniqueCode and category are required' });
    const result = await notificationsService.getCategoryNotificationsService(
      uniqueCode,
      category,
      req.pagination
    );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Category notifications retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] getCategoryNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const searchNotifications = async (req, res) => {
  try {
    const {
      uniqueCode,
      searchTerm,
      filter = 'all',
      category = 'all',
    } = req.body;
    if (!uniqueCode || !searchTerm)
      return sendSuccess(res, {
        status: HTTP.BAD_REQUEST,
        message: 'uniqueCode and searchTerm are required',
      });
    const result = await notificationsService.searchNotificationsService(
      uniqueCode,
      searchTerm,
      filter,
      category,
      req.pagination
    );
    sendSuccess(res, {
      status: HTTP.OK,
      message: 'Search results retrieved successfully',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('[Notification] searchNotifications:', error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delivery Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /get-pending-notifications
 * Returns pending (undelivered) notifications for a user.
 */
const getPendingNotifications = async (req, res) => {
  try {
    const { uniqueCode, since, limit = 100 } = req.body;
    logger.info(
      '[Notification] getPendingNotifications request body:',
      req.body
    );

    if (!uniqueCode) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, error: 'uniqueCode is required' });
    }

    const result = await notificationsService.getPendingNotifications(
      uniqueCode,
      since,
      limit
    );

    // Dispatch fetched notifications to devices (websocket + FCM + VoIP sync)
    try {
      const dispatchPromises = result.notifications.map((notif) => {
        const title = notif.title || notif.message || '';
        const description =
          notif.description && typeof notif.description === 'object'
            ? notif.description.message || JSON.stringify(notif.description)
            : notif.description || notif.message || '';
        const priority = notif.priority || 'medium';
        const type = notif.type || 'normal';
        const id = notif._id;

        if (notif.isBroadcast) {
          return PushNotificationService.sendGeneralNotification(
            null,
            title,
            description,
            priority,
            type,
            id
          );
        }

        if (Array.isArray(notif.targetUsers) && notif.targetUsers.length > 0) {
          return PushNotificationService.sendGeneralNotification(
            notif.targetUsers,
            title,
            description,
            priority,
            type,
            id
          );
        }

        // Fallback: dispatch to the requesting user
        return PushNotificationService.sendGeneralNotification(
          uniqueCode,
          title,
          description,
          priority,
          type,
          id
        );
      });

      const dispatchResults = await Promise.allSettled(dispatchPromises);
      logger.info(
        '[Notification] dispatched pending notifications:',
        dispatchResults.map((r) => r.status)
      );
    } catch (err) {
      logger.error(
        '[Notification] error dispatching pending notifications:',
        err
      );
    }

    sendSuccess(res, {
      success: true,
      notifications: result.notifications,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('[Notification] getPendingNotifications:', error);
    sendError(res, {
      success: false,
      error: 'Failed to fetch pending notifications',
      message: error.message,
    });
  }
};

/**
 * POST /mark-delivered
 * Marks a notification as delivered for a specific user.
 */
const markNotificationAsDelivered = async (req, res) => {
  try {
    const { notificationId, uniqueCode } = req.body;

    if (!notificationId || !uniqueCode) {
      return sendError(res, {
        success: false,
        error: 'notificationId and uniqueCode are required',
      });
    }

    const result = await notificationsService.markNotificationAsDelivered(
      notificationId,
      uniqueCode
    );
    if (!result.success && result.message === 'Invalid notification ID') {
      return sendSuccess(res, result);
    }

    res.json(result);
  } catch (error) {
    logger.error('[Notification] markNotificationAsDelivered:', error);
    sendError(res, { success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  getAllNotifications,
  getNotificationStats,
  markAsRead,
  deleteNotification,
  // Tabs
  getUnreadNotifications,
  getForYouNotifications,
  getHighPriorityNotifications,
  getUserSpecificNotifications,
  getCategoryNotifications,
  getUserSpecificTabs,
  getModelCategories,
  searchNotifications,
  // Delivery
  getPendingNotifications,
  markNotificationAsDelivered,
};
