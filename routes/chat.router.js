const express = require('express');
const router  = express.Router();

const controller = require('../controllers/chat.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Chat Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Chats ─────────────────────────────────────────────────────────────────────
router.get   ('/chats',                  controller.getUserChats);
router.get   ('/chats/:chatId',          controller.getChatDetails);
router.post  ('/chats/individual',       controller.getOrCreateIndividualChat);
router.post  ('/chats/group',            controller.createGroupChat);
router.put   ('/chats/:chatId',          controller.updateGroupChat);
router.delete('/chats/:chatId',          controller.deleteChat);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get   ('/chats/:chatId/messages', controller.getMessages);
router.post  ('/chats/:chatId/read',     controller.markAsRead);
router.post  ('/messages/text',          controller.sendTextMessage);
router.delete('/messages/:messageId',    controller.deleteMessage);

// ── Uploads ───────────────────────────────────────────────────────────────────
router.post('/upload/audio',             controller.uploadVoiceMessage);
router.post('/upload/image',             controller.uploadImage);
router.post('/upload/video',             controller.uploadVideo);
router.post('/upload/document',          controller.uploadDocument);

// ── Calls ─────────────────────────────────────────────────────────────────────
router.get ('/calls/history',            controller.getCallHistory);
router.post('/calls/record',             controller.saveCallRecord);

module.exports = router;