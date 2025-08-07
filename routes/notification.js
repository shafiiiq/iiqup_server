var express = require('express');
var router = express.Router();
const notificationController = require('../controllers/notification.controller');

// Get all notifications
router.get('/get-all-notification', notificationController.getAllNotifications);

// Create new notification (with real-time broadcasting)
router.post('/create-notification', notificationController.createNotification);

// Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// Mark notification as read
router.put('/mark-read/:id', notificationController.markAsRead);

// Delete notification
router.delete('/delete/:id', notificationController.deleteNotification);

router.post('/get-pending-notifications', notificationController.getPendingNotifications);

module.exports = router;