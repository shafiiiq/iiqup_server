const express = require('express');
const router  = express.Router();

const controller = require('../controllers/otp.controller');

// ─────────────────────────────────────────────────────────────────────────────
// OTP Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post('/request',        controller.requestOTP);
router.post('/verify',         controller.verifyOTP);
router.post('/reset-password', controller.resetPassword);

module.exports = router;