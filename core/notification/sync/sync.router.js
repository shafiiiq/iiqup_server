const express = require('express');
const { syncAuthMiddleware } = require('./sync.auth.middleware');
const controller = require('./sync.controller');

const router = express.Router();
 
router.use(syncAuthMiddleware);
router.get('/queue', controller.listQueue);
router.post('/ack', controller.acknowledge);

module.exports = router;