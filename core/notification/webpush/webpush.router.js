const express = require('express');
const router = express.Router();
const controller = require('./webpush.controller');

router.post('/subscribe', controller.subscribe);
router.post('/send', controller.send);

module.exports = router;