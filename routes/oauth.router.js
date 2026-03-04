const express = require('express');
const router  = express.Router();

const controller = require('../controllers/oauth.controller');

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post('/refresh', controller.verifyRefresh);

module.exports = router;