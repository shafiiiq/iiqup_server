const express = require('express');
const router = express.Router();

const controller = require('./oauth.controller');

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post('/refresh', controller.verifyRefresh);

module.exports = router;
