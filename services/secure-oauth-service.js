// services/secure-oauth.service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis'); 
const GOAuth = require('../models/GOAuth.model');

/**
 * Get or refresh OAuth2 access token
 */
const getValidAccessToken = async (service = 'gmail') => {
  try {
    // Get stored tokens
    const tokens = await GOAuth.getTokens(service);
    
    const oauth2Client = new google.auth.OAuth2(
      tokens.client_id,
      tokens.client_secret,
      process.env.GMAIL_REDIRECT_URL || 'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: tokens.refresh_token
    });

    // If access token is expired or missing, refresh it
    if (tokens.is_expired || !tokens.access_token) {
      console.log('🔄 Refreshing expired access token...');
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Save new access token to database
      await GOAuth.updateAccessToken(
        service,
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
    throw new Error(`OAuth token error: ${error.message}`);
  }
};

/**
 * Create secure OAuth2 transporter
 */
const createSecureOAuthTransporter = async () => {
  try {
    const tokens = await getValidAccessToken('gmail');
    
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
    throw new Error(`Failed to create OAuth transporter: ${error.message}`);
  }
};

/**
 * Initialize OAuth tokens (run once during setup)
 */
const initializeOAuthTokens = async (tokens) => {
  try {
    const savedTokens = await GOAuth.saveTokens('gmail', {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      client_id: tokens.client_id || process.env.GMAIL_CLIENT_ID,
      client_secret: tokens.client_secret || process.env.GMAIL_CLIENT_SECRET
    });

    console.log('✅ OAuth tokens encrypted and saved to database');
    return savedTokens;
  } catch (error) {
    throw new Error(`Failed to initialize tokens: ${error.message}`);
  }
};

/**
 * Test OAuth setup
 */
const testOAuthSetup = async () => {
  try {
    console.log('🔍 Testing OAuth setup...');
    
    // Test token retrieval and refresh
    const tokens = await getValidAccessToken('gmail');
    console.log('✅ Tokens retrieved successfully');
    
    // Test transporter creation
    const transporter = await createSecureOAuthTransporter();
    await transporter.verify();
    transporter.close();
    
    console.log('✅ OAuth transporter verified');
    return { success: true, message: 'OAuth setup is working' };
    
  } catch (error) {
    console.error('❌ OAuth test failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Revoke OAuth tokens (for security)
 */
const revokeOAuthTokens = async (service = 'gmail') => {
  try {
    await GOAuth.revokeTokens(service);
    console.log(`✅ ${service} tokens revoked`);
  } catch (error) {
    throw new Error(`Failed to revoke tokens: ${error.message}`);
  }
};

module.exports = {
  createSecureOAuthTransporter,
  initializeOAuthTokens,
  testOAuthSetup,
  revokeOAuthTokens,
  getValidAccessToken
};