const express = require('express');
const { authMiddleware } = require('#middlewares/jwt.middleware');
const tokenRouter = require('#core/notification/token/token.router');
const controller = require('./notification.controller');
const replyController = require('./notification.reply.controller');
const composeController = require('./notification.compose.controller');
const distributionController = require('./notification.distribution.controller');
const summaryController = require('./notification.summary.controller');
const categoryController = require('./notification.category.controller');
const featureController = require('./notification.feature.controller');
const replySummaryController = require('./notification.reply.summary.controller');
const deliveryController = require('./notification.delivery.controller');
const documentController = require('./notification.document.controller');
const calendarController = require('./notification.calendar.controller');

const router = express.Router();

router.use('/token', tokenRouter);
router.use(authMiddleware);

router.get('/', controller.listNotifications);
router.get('/tabs', controller.listTabs);
router.get('/counts', controller.getCounts);
router.get('/calendar', calendarController.getCalendar);
router.get('/documents/unseen', documentController.getUnseenDocuments);
router.put('/documents/:sourceKey/viewed-all', documentController.markAllViewed);
router.put('/documents/:sourceKey/:documentId/viewed', documentController.markViewed);
router.get('/pending', deliveryController.listPending);
router.put('/delivered', deliveryController.markDelivered);
router.get('/mentionable', replyController.searchMentionable);
router.get('/mentions', replyController.listMentionTargets);
router.get('/distributions', distributionController.listDistributions);
router.post('/distributions/:distributionKey/submit', distributionController.submitDistribution);
router.get(
  '/distributions/:distributionKey/fields/:fieldKey/suggestions',
  distributionController.listFieldSuggestions
);
router.post('/compose', composeController.composeMessage);
router.get('/summary', summaryController.getSummary);
router.get('/categories', summaryController.searchCategories);
router.get('/categories/:categoryKey/members', categoryController.listMembers);
router.post('/categories/:categoryKey/members', categoryController.addMembers);
router.delete('/categories/:categoryKey/members/:uniqueCode', categoryController.removeMember);
router.get('/attachment-features', featureController.listFeatures);
router.get('/attachment-features/:featureKey/documents', featureController.searchDocuments);
router.get('/:id/replies/summary', replySummaryController.getReplySummary);
router.put('/read-all', controller.markAllRead);
router.put('/replies/:replyId/like', replyController.setReplyLike);

router.put('/:notificationId/read', controller.markRead);
router.put('/:notificationId/like', controller.setLike);
router.get('/:notificationId/viewers', controller.listViewers);
router.get('/:notificationId/replies', replyController.listReplies);
router.post('/:notificationId/replies', replyController.createReply);
router.put('/:notificationId/replies/viewed', replyController.markRepliesViewed);

module.exports = router;