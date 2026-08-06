const express = require('express');
const router = express.Router();

const controller = require('./notification.controller');
const { paginationMiddleware } = require('../../shared/pagination');

// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.post('/stats', controller.getNotificationStats);
router.post(
  '/get-all-notification',
  paginationMiddleware,
  controller.getAllNotifications
);
router.put('/mark-read/:id', controller.markAsRead);
router.post('/tab/unread', paginationMiddleware, controller.getUnreadNotifications);
router.post('/tab/foryou', paginationMiddleware, controller.getForYouNotifications);
router.post(
  '/tab/high-priority',
  paginationMiddleware,
  controller.getHighPriorityNotifications
);
router.post(
  '/tab/user-specific',
  paginationMiddleware,
  controller.getUserSpecificNotifications
);
router.post('/tab/category', paginationMiddleware, controller.getCategoryNotifications);
router.post('/tab/meta/user-tabs', controller.getUserSpecificTabs);
router.post('/tab/meta/categories', controller.getModelCategories);
router.post('/search', paginationMiddleware, controller.searchNotifications);
router.delete('/delete/:id', controller.deleteNotification);

// ── Delivery ──────────────────────────────────────────────────────────────────
router.post('/get-pending-notifications', controller.getPendingNotifications);
router.post('/mark-delivered', controller.markNotificationAsDelivered);

module.exports = router;
