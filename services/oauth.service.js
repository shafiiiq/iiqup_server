// services/oauth.service.js
const nodemailer  = require('nodemailer');
const jwt         = require('jsonwebtoken');
const { google }  = require('googleapis');
const GOAuth      = require('../models/GOAuth.model');
const { generateTokens } = require('../utils/jwt.utils');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Token Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given service,
 * refreshing it if expired or missing.
 */
const getValidAccessToken = async (service = 'gmail') => {
  try {
    const tokens = await GOAuth.getTokens(service);

    const oauth2Client = new google.auth.OAuth2(
      tokens.client_id,
      tokens.client_secret,
      process.env.GMAIL_REDIRECT_URL || 'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

    if (tokens.is_expired || !tokens.access_token) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await GOAuth.updateAccessToken(service, credentials.access_token, credentials.expiry_date);

      return {
        access_token:   credentials.access_token,
        client_id:      tokens.client_id,
        client_secret:  tokens.client_secret,
        refresh_token:  tokens.refresh_token,
      };
    }

    return tokens;
  } catch (error) {
    throw new Error(`[OAuthService] getValidAccessToken: ${error.message}`);
  }
};

/**
 * Creates and returns a nodemailer OAuth2 transporter for Gmail.
 */
const createSecureOAuthTransporter = async () => {
  try {
    const tokens = await getValidAccessToken('gmail');

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type:         'OAuth2',
        user:         process.env.OTP_MAILER.replace(/"/g, ''),
        clientId:     tokens.client_id,
        clientSecret: tokens.client_secret,
        refreshToken: tokens.refresh_token,
        accessToken:  tokens.access_token,
      },
    });
  } catch (error) {
    throw new Error(`[OAuthService] createSecureOAuthTransporter: ${error.message}`);
  }
};

/**
 * Saves initial OAuth tokens to the database. Run once during setup.
 */
const initializeOAuthTokens = async (tokens) => {
  try {
    return await GOAuth.saveTokens('gmail', {
      refresh_token: tokens.refresh_token,
      access_token:  tokens.access_token,
      expiry_date:   tokens.expiry_date,
      client_id:     tokens.client_id     || process.env.GMAIL_CLIENT_ID,
      client_secret: tokens.client_secret || process.env.GMAIL_CLIENT_SECRET,
    });
  } catch (error) {
    throw new Error(`[OAuthService] initializeOAuthTokens: ${error.message}`);
  }
};

/**
 * Tests that OAuth token retrieval and the transporter are working.
 */
const testOAuthSetup = async () => {
  try {
    await getValidAccessToken('gmail');

    const transporter = await createSecureOAuthTransporter();
    await transporter.verify();
    transporter.close();

    return { success: true, message: 'OAuth setup is working' };
  } catch (error) {
    console.error('[OAuthService] testOAuthSetup:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Revokes stored OAuth tokens for the given service.
 */
const revokeOAuthTokens = async (service = 'gmail') => {
  try {
    await GOAuth.revokeTokens(service);
  } catch (error) {
    throw new Error(`[OAuthService] revokeOAuthTokens: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT Refresh
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a refresh token and returns new access + refresh tokens.
 */
const authRefresh = async (refreshToken) => {
  try {
    if (!refreshToken) {
      return { status: 401, success: false, message: 'Refresh token is required' };
    }

    // Strip surrounding quotes if token was JSON-stringified
    let token = refreshToken;
    if (typeof token === 'string' && token.startsWith('"') && token.endsWith('"')) {
      try { token = JSON.parse(token); } catch (_) {}
    }

    token = token.trim();

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return { status: 403, success: false, message: 'Invalid token type (must be refresh)' };
    }

    const tokens = generateTokens({ _id: decoded.id, email: decoded.email, role: decoded.role });

    return {
      status:       200,
      success:      true,
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    console.error('[OAuthService] authRefresh:', error.message);

    let message = 'Invalid refresh token';
    if (error.name === 'TokenExpiredError')  message = 'Refresh token expired';
    if (error.name === 'JsonWebTokenError')  message = 'Malformed refresh token';

    return { status: 403, success: false, message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getValidAccessToken,
  createSecureOAuthTransporter,
  initializeOAuthTokens,
  testOAuthSetup,
  revokeOAuthTokens,
  authRefresh,
};