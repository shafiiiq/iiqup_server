const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');

// ########### CHAT ###########
// Get all chats for a user (with team filter)
router.get('/chats', chatController.getUserChats);

// Get or create individual chat
router.post('/chats/individual', chatController.getOrCreateIndividualChat);

// Create group chat
router.post('/chats/group', chatController.createGroupChat);

// Get chat details
router.get('/chats/:chatId', chatController.getChatDetails);

// Update group chat (name, avatar, add/remove members)
router.put('/chats/:chatId', chatController.updateGroupChat);

// Delete chat (soft delete for user)
router.delete('/chats/:chatId', chatController.deleteChat);

// ########### MESSAGES ###########
// get chat messages
router.get('/chats/:chatId/messages', chatController.getMessages);

// send message
router.post('/messages/text', chatController.sendTextMessage);

// message mark as read
router.post('/chats/:chatId/read', chatController.markAsRead);

// delete message
router.delete('/messages/:messageId', chatController.deleteMessage);

// Upload voice message
router.post('/upload/audio', chatController.uploadVoiceMessage);

// Upload image
router.post('/upload/image', chatController.uploadImage);

// Upload video
router.post('/upload/video', chatController.uploadVideo);

// Upload document
router.post('/upload/document', chatController.uploadDocument);


// ########### CALL ###########
// Get call history
router.get('/calls/history', chatController.getCallHistory);

// Save call record
router.post('/calls/record', chatController.saveCallRecord);

module.exports = router;