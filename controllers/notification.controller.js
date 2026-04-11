// controllers/notification.controller.js
const notificationsService                              = require('../services/notification.service');
const { sendNotificationToUser, broadcastNotification } = require('../sockets/websocket');

// ─────────────────────────────────────────────────────────────────────────────
// Notification CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /get-all-notification
 * Returns all notifications for a user with pagination.
 */
const getAllNotifications = async (req, res) => {
  try {
    const { uniqueCode, page = 1, limit = 100 } = req.body;

    const result = await notificationsService.getAllNotificationsService(
      uniqueCode,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      status:  200,
      message: 'Notifications retrieved successfully',
      data:    result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    });
  } catch (error) {
    console.error('[Notification] getAllNotifications:', error);
    res.status(500).json({ status: 500, message: error.message });
  }
};

/**
 * GET /stats
 * Returns notification statistics.
 */
const getNotificationStats = async (req, res) => {
  try {
    const { uniqueCode } = req.body

    if (!uniqueCode) {
      return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    }

    const stats = await notificationsService.getNotificationStatsService(uniqueCode)

    res.status(200).json({ status: 200, message: 'Stats retrieved successfully', data: stats })
  } catch (error) {
    console.error('[Notification] getNotificationStats:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

/**
 * PUT /mark-read/:id
 * Marks a notification as read.
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { uniqueCode } = req.body;

    if (!uniqueCode) {
      return res.status(400).json({ status: 400, message: 'uniqueCode is required' });
    }

    const result = await notificationsService.markNotificationAsRead(id, uniqueCode);

    res.status(200).json({ status: 200, message: result.message });
  } catch (error) {
    console.error('[Notification] markAsRead:', error);
    res.status(500).json({ status: 500, message: error.message });
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

    res.status(200).json({ status: 200, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('[Notification] deleteNotification:', error);
    res.status(500).json({ status: 500, message: error.message });
  }
};

const getUnreadNotifications = async (req, res) => {
  try {
    const { uniqueCode, page = 1, limit = 100 } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const result = await notificationsService.getUnreadNotificationsService(uniqueCode, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'Unread notifications retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] getUnreadNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getForYouNotifications = async (req, res) => {
  try {
    const { uniqueCode, page = 1, limit = 100 } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const result = await notificationsService.getForYouNotificationsService(uniqueCode, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'For you notifications retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] getForYouNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getHighPriorityNotifications = async (req, res) => {
  try {
    const { uniqueCode, page = 1, limit = 100 } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const result = await notificationsService.getHighPriorityNotificationsService(uniqueCode, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'High priority notifications retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] getHighPriorityNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getUserSpecificNotifications = async (req, res) => {
  try {
    const { uniqueCode, sourceId, page = 1, limit = 100 } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const result = await notificationsService.getUserSpecificNotificationsService(uniqueCode, sourceId, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'User specific notifications retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] getUserSpecificNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getUserSpecificTabs = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const tabs = await notificationsService.getUserSpecificTabsService(uniqueCode)
    res.status(200).json({ status: 200, message: 'User specific tabs retrieved successfully', data: tabs })
  } catch (error) {
    console.error('[Notification] getUserSpecificTabs:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getModelCategories = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return res.status(400).json({ status: 400, message: 'uniqueCode is required' })
    const categories = await notificationsService.getModelCategoriesService(uniqueCode)
    res.status(200).json({ status: 200, message: 'Model categories retrieved successfully', data: categories })
  } catch (error) {
    console.error('[Notification] getModelCategories:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const getCategoryNotifications = async (req, res) => {
  try {
    const { uniqueCode, category, page = 1, limit = 100 } = req.body
    if (!uniqueCode || !category) return res.status(400).json({ status: 400, message: 'uniqueCode and category are required' })
    const result = await notificationsService.getCategoryNotificationsService(uniqueCode, category, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'Category notifications retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] getCategoryNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

const searchNotifications = async (req, res) => {
  try {
    const { uniqueCode, searchTerm, filter = 'all', category = 'all', page = 1, limit = 50 } = req.body
    if (!uniqueCode || !searchTerm) return res.status(400).json({ status: 400, message: 'uniqueCode and searchTerm are required' })
    const result = await notificationsService.searchNotificationsService(uniqueCode, searchTerm, filter, category, parseInt(page), parseInt(limit))
    res.status(200).json({
      status: 200,
      message: 'Search results retrieved successfully',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages:  result.totalPages,
        totalCount:  result.totalCount,
        hasMore:     result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('[Notification] searchNotifications:', error)
    res.status(500).json({ status: 500, message: error.message })
  }
}

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

    if (!uniqueCode) {
      return res.status(400).json({ success: false, error: 'uniqueCode is required' });
    }

    const result = await notificationsService.getPendingNotifications(uniqueCode, since, limit);

    res.status(200).json({
      success:       true,
      notifications: result.notifications,
      meta:          result.meta,
    });
  } catch (error) {
    console.error('[Notification] getPendingNotifications:', error);
    res.status(500).json({
      success: false,
      error:   'Failed to fetch pending notifications',
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
      return res.status(400).json({
        success: false,
        error:   'notificationId and uniqueCode are required',
      });
    }

    const result = await notificationsService.markNotificationAsDelivered(notificationId, uniqueCode);

    res.json(result);
  } catch (error) {
    console.error('[Notification] markNotificationAsDelivered:', error);
    res.status(500).json({ success: false, error: error.message });
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
}