// controllers/s3.controller.js
const s3Services = require('../services/s3.service');

// ─────────────────────────────────────────────────────────────────────────────
// S3 Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /s3/config
 * Returns a pre-signed S3 URL for the given key.
 */
const getS3Config = async (req, res) => {
  try {
    const { key, isLong, isAuthSign } = req.body;
    
    console.log("keyyyyyy", key)
    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required' });
    }

    const result = await s3Services.fetchPresignedURL(key, isLong, isAuthSign);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[S3] getS3Config:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getS3Config,
};