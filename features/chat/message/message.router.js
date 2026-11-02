const express = require('express');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const controller = require('./message.controller');

const router = express.Router();

router.get('/chats/:chatId/messages', paginationMiddleware, controller.getMessages);
router.get('/chats/:chatId/presence', controller.getChatPresence);
router.post('/chats/:chatId/read', controller.markAsRead);
router.post('/messages/text', controller.sendTextMessage);
router.put('/messages/:messageId/edit', controller.editMessage);
router.put('/messages/:messageId/caption', controller.updateCaption);
router.post('/messages/:messageId/forward', controller.forwardMessage);
router.delete('/messages/:messageId', controller.deleteMessage);

module.exports = router;