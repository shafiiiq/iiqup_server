const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otp.controller');

// OTP endpoints
router.post('/request', otpController.requestOTP);
router.post('/verify', otpController.verifyOTP);
router.post('/reset-password', otpController.resetPassword);

module.exports = router;