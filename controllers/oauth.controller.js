// controllers/oauth.controller.js
const oauthServices = require('../services/oauth.service');

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
      return res.status(400).json({ success: false, message: 'refreshToken is required' });
    }

    const result = await oauthServices.authRefresh(refreshToken);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[OAuth] verifyRefresh:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  verifyRefresh,
};