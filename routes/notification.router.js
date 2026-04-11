const express = require('express');
const router  = express.Router();

const controller = require('../controllers/notification.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.post  ('/stats',                   controller.getNotificationStats)
router.post  ('/get-all-notification',    controller.getAllNotifications)
router.put   ('/mark-read/:id',           controller.markAsRead)
router.post  ('/tab/unread',              controller.getUnreadNotifications)
router.post  ('/tab/foryou',              controller.getForYouNotifications)
router.post  ('/tab/high-priority',       controller.getHighPriorityNotifications)
router.post  ('/tab/user-specific',       controller.getUserSpecificNotifications)
router.post  ('/tab/category',            controller.getCategoryNotifications)
router.post  ('/tab/meta/user-tabs',      controller.getUserSpecificTabs)
router.post  ('/tab/meta/categories',     controller.getModelCategories)
router.post  ('/search',                  controller.searchNotifications)
router.delete('/delete/:id',              controller.deleteNotification)

// ── Delivery ──────────────────────────────────────────────────────────────────
router.post('/get-pending-notifications',  controller.getPendingNotifications);
router.post('/mark-delivered',             controller.markNotificationAsDelivered);

module.exports = router;