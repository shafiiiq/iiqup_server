const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/s3.controller.js
const s3Services = require('../../shared/services/s3.service.js');

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

    logger.info('[S3] getS3Config request', { key, isLong, isAuthSign });

    if (!key) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'key is required' });
    }

    const result = await s3Services.fetchPresignedURL(key, isLong, isAuthSign);

    logger.info('[S3] getS3Config result', {
      key,
      status: result.status,
      ok: result.ok,
      message: result.message,
    });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[S3] getS3Config:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getS3Config,
};
