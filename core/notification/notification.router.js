const express = require('express');
const router = express.Router();

const controller = require('./notification.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.get('/', authMiddleware, paginationMiddleware, controller.getAllNotifications);
router.get('/pending', authMiddleware, controller.getPendingNotifications);
router.get('/stats', authMiddleware, controller.getNotificationStats);
router.get('/search', authMiddleware, paginationMiddleware, controller.searchNotifications);

router.get('/tab/unread', authMiddleware, paginationMiddleware, controller.getUnreadNotifications);
router.get('/tab/foryou', authMiddleware, paginationMiddleware, controller.getForYouNotifications);
router.get('/tab/high-priority', authMiddleware, paginationMiddleware, controller.getHighPriorityNotifications);
router.get('/tab/user-specific', authMiddleware, paginationMiddleware, controller.getUserSpecificNotifications);
router.get('/tab/category', authMiddleware, paginationMiddleware, controller.getCategoryNotifications);
router.get('/tab/meta/user-tabs', authMiddleware, controller.getUserSpecificTabs);
router.get('/tab/meta/categories', authMiddleware, controller.getModelCategories);

router.put('/:id/delivered', authMiddleware, controller.markNotificationAsDelivered);
router.put('/:id/read', authMiddleware, controller.markAsRead);

router.get('/token', authMiddleware, controller.getUserPushTokens);
router.post('/token/push', authMiddleware, controller.insertPushToken);
router.post('/token/voip', authMiddleware, controller.insertVoipToken);
router.delete('/token/push', authMiddleware, controller.removePushToken);

module.exports = router;