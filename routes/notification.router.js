const express = require('express');
const router  = express.Router();

const controller = require('../controllers/notification.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Notification Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.get   ('/stats',                    controller.getNotificationStats);
router.post  ('/get-all-notification',     controller.getAllNotifications);
router.post  ('/create-notification',      controller.createNotification);
router.put   ('/mark-read/:id',            controller.markAsRead);
router.delete('/delete/:id',               controller.deleteNotification);

// ── Delivery ──────────────────────────────────────────────────────────────────
router.post('/get-pending-notifications',  controller.getPendingNotifications);
router.post('/mark-delivered',             controller.markNotificationAsDelivered);

module.exports = router;