const express = require('express');
const router  = express.Router();

const controller = require('../controllers/s3.controller');

// ─────────────────────────────────────────────────────────────────────────────
// S3 Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post('/get-pre-signed-url', controller.getS3Config);

module.exports = router;