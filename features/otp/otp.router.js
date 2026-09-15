const express = require('express');
const router = express.Router();

const controller = require('./otp.controller');

router.post('/request', controller.requestOTP);
router.post('/verify', controller.verifyOTP);

module.exports = router;