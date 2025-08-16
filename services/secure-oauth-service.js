
// services/secure-oauth.service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis'); 

// Ensure GOAuth model is available
let GOAuth;
try {
  GOAuth = require('../models/GOAuth.model');
  if (!GOAuth || typeof GOAuth.getTokens !== 'function') {
    throw new Error('GOAuth model not properly loaded');
  }
} catch (error) {
  console.error('Failed to load GOAuth model:', error.message);
  throw error;
}

const getValidAccessToken = async (service = 'gmail', accountId = 'default') => {
  try {
    const tokens = await GOAuth.getTokens(service, accountId);
    
    const oauth2Client = new google.auth.OAuth2(
      tokens.client_id,
      tokens.client_secret,
      process.env.GMAIL_REDIRECT_URL || 'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token
    });

    if (tokens.is_expired || !tokens.access_token) {
      console.log('Refreshing access token...');
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      await GOAuth.updateAccessToken(
        service,
        accountId,
        credentials.access_token,
        credentials.expiry_date
      );
      
      return {
        access_token: credentials.access_token,
        client_id: tokens.client_id,
        client_secret: tokens.client_secret,
        refresh_token: tokens.refresh_token
      };
    }

    return tokens;
  } catch (error) {
    throw new Error(`Token error: ${error.message}`);
  }
};

const createSecureOAuthTransporter = async (accountId = 'default') => {
  try {
    const tokens = await getValidAccessToken('gmail', accountId);
    
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.OTP_MAILER.replace(/"/g, ''),
        clientId: tokens.client_id,
        clientSecret: tokens.client_secret,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token
      }
    });
  } catch (error) {
    throw new Error(`Transporter failed: ${error.message}`);
  }
};

const initializeOAuthTokens = async (tokens, accountId = 'default') => {
  try {
    const savedTokens = await GOAuth.saveTokens('gmail', accountId, {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      client_id: tokens.client_id || process.env.GMAIL_CLIENT_ID,
      client_secret: tokens.client_secret || process.env.GMAIL_CLIENT_SECRET
    });

    console.log('OAuth tokens saved');
    return savedTokens;
  } catch (error) {
    throw new Error(`Initialize failed: ${error.message}`);
  }
};

const testOAuthSetup = async (accountId = 'default') => {
  try {
    console.log('Testing OAuth...');
    
    const tokens = await getValidAccessToken('gmail', accountId);
    console.log('Tokens OK');
    
    const transporter = await createSecureOAuthTransporter(accountId);
    await transporter.verify();
    transporter.close();
    
    console.log('OAuth working');
    return { success: true };
    
  } catch (error) {
    console.error('OAuth test failed:', error.message);
    return { success: false, error: error.message };
  }
};

const revokeOAuthTokens = async (service = 'gmail', accountId = 'default') => {
  try {
    await GOAuth.revokeTokens(service, accountId);
    console.log(`${service} tokens revoked`);
  } catch (error) {
    throw new Error(`Revoke failed: ${error.message}`);
  }
};

module.exports = {
  createSecureOAuthTransporter,
  initializeOAuthTokens,
  testOAuthSetup,
  revokeOAuthTokens,
  getValidAccessToken
};