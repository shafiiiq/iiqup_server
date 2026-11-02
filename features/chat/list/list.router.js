const express = require('express');
const controller = require('./list.controller');

const router = express.Router();

router.get('/chats', controller.getUserChats);
router.post('/chats/individual', controller.getOrCreateIndividualChat);
router.get('/chats/:chatId', controller.getChatDetails);
router.put('/chats/:chatId/favorite', controller.setFavorite);
router.delete('/chats/:chatId', controller.deleteChat);

module.exports = router;