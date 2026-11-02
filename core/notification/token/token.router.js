const express = require('express');
const { authMiddleware } = require('#middlewares/jwt.middleware');
const controller = require('./token.controller');

const router = express.Router();

router.use(authMiddleware);
router.get('/', controller.getUserPushTokens);
router.post('/push', controller.insertPushToken);
router.post('/voip', controller.insertVoipToken);
router.delete('/push', controller.removePushToken);
router.post('/web', controller.insertWebPushSubscription);
router.delete('/web', controller.removeWebPushSubscription);

module.exports = router;