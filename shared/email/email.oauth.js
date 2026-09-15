// shared/email/gmail.oauth.js
const logger = require('#shared/logger/logger')
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const GOAuth = require('../../core/authN/authN.model')

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
        access_token: credentials.access_token,
        client_id: tokens.client_id,
        client_secret: tokens.client_secret,
        refresh_token: tokens.refresh_token,
      };
    }

    return tokens;
  } catch (error) {
    throw new Error(`[gmail.oauth] getValidAccessToken: ${error.message}`);
  }
};

const createSecureOAuthTransporter = async () => {
  try {
    const tokens = await getValidAccessToken('gmail');

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.OTP_MAILER?.replace(/"/g, ''),
        clientId: tokens.client_id,
        clientSecret: tokens.client_secret,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
      },
    });
  } catch (error) {
    throw new Error(`[gmail.oauth] createSecureOAuthTransporter: ${error.message}`);
  }
};

const initializeOAuthTokens = async (tokens) => {
  try {
    return await GOAuth.saveTokens('gmail', {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      client_id: tokens.client_id || process.env.GMAIL_CLIENT_ID,
      client_secret: tokens.client_secret || process.env.GMAIL_CLIENT_SECRET,
    });
  } catch (error) {
    throw new Error(`[gmail.oauth] initializeOAuthTokens: ${error.message}`);
  }
};

const testOAuthSetup = async () => {
  try {
    await getValidAccessToken('gmail');

    const transporter = await createSecureOAuthTransporter();
    await transporter.verify();
    transporter.close();

    return { success: true, message: 'OAuth setup is working' };
  } catch (error) {
    logger.error('[gmail.oauth] testOAuthSetup', error.message);
    return { success: false, error: error.message };
  }
};

const revokeOAuthTokens = async (service = 'gmail') => {
  try {
    await GOAuth.revokeTokens(service);
  } catch (error) {
    throw new Error(`[gmail.oauth] revokeOAuthTokens: ${error.message}`);
  }
};

module.exports = {
  getValidAccessToken,
  createSecureOAuthTransporter,
  initializeOAuthTokens,
  testOAuthSetup,
  revokeOAuthTokens,
};