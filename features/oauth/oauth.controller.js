const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/oauth.controller.js
const oauthServices = require('./oauth.service');

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /oauth/refresh
 * Verifies a refresh token and returns a new access token.
 */
const verifyRefresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'refreshToken is required' });
    }

    const result = await oauthServices.authRefresh(refreshToken);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[OAuth] verifyRefresh:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  verifyRefresh,
};
