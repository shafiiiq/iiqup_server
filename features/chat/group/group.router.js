const express = require('express');
const controller = require('./group.controller');

const router = express.Router();

router.post('/chats/group', controller.createGroupChat);
router.put('/chats/:chatId', controller.updateGroupChat);
router.post('/chats/:chatId/leave', controller.leaveGroupChat);

module.exports = router;