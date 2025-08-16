// models/GOAuth.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const oAuthSchema = new mongoose.Schema({
  service: {
    type: String,
    required: true,
    enum: ['gmail', 'outlook', 'smtp']
  },
  accountId: {
    type: String,
    required: true
  },
  encryptedRefreshToken: {
    type: String,
    required: true
  },
  encryptedAccessToken: {
    type: String,
    default: null
  },
  tokenExpiry: {
    type: Date,
    default: null
  },
  clientId: {
    type: String,
    required: true
  },
  encryptedClientSecret: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound unique index
oAuthSchema.index({ service: 1, accountId: 1 }, { unique: true });

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';

const getEncryptionKey = () => {
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required');
  }
  return Buffer.from(process.env.OAUTH_ENCRYPTION_KEY, 'hex');
};

/**
 * Encrypt sensitive data using AES-256-CBC
 */
const encrypt = (text) => {
  if (!text) return null;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption failed');
    return null;
  }
};

/**
 * Decrypt sensitive data using AES-256-CBC
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 2) throw new Error('Invalid format');
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed');
    return null;
  }
};

// Static methods for token management
oAuthSchema.statics.saveTokens = async function(service, accountId, tokens) {
  const encryptedData = {
    service,
    accountId,
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    encryptedAccessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    clientId: tokens.client_id,
    encryptedClientSecret: encrypt(tokens.client_secret),
    lastUsed: new Date(),
    updatedAt: new Date()
  };

  return await this.findOneAndUpdate(
    { service, accountId },
    encryptedData,
    { upsert: true, new: true }
  );
};

oAuthSchema.statics.getTokens = async function(service, accountId) {
  const record = await this.findOne({ service, accountId, isActive: true });
  
  if (!record) {
    throw new Error(`No tokens found for ${service}:${accountId}`);
  }

  const isExpired = record.tokenExpiry && new Date() >= record.tokenExpiry;
  
  return {
    refresh_token: decrypt(record.encryptedRefreshToken),
    access_token: isExpired ? null : decrypt(record.encryptedAccessToken),
    client_id: record.clientId,
    client_secret: decrypt(record.encryptedClientSecret),
    expiry_date: record.tokenExpiry,
    is_expired: isExpired,
    last_used: record.lastUsed
  };
};

oAuthSchema.statics.updateAccessToken = async function(service, accountId, accessToken, expiryDate) {
  return await this.findOneAndUpdate(
    { service, accountId, isActive: true },
    {
      encryptedAccessToken: encrypt(accessToken),
      tokenExpiry: new Date(expiryDate),
      lastUsed: new Date(),
      updatedAt: new Date()
    },
    { new: true }
  );
};

oAuthSchema.statics.revokeTokens = async function(service, accountId) {
  return await this.findOneAndUpdate(
    { service, accountId },
    {
      isActive: false,
      updatedAt: new Date()
    },
    { new: true }
  );
};

oAuthSchema.pre('save', function() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('GOAuth', oAuthSchema);

// services/secure-oauth.service.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis'); 
const GOAuth = require('../models/GOAuth.model');

/**
 * Get or refresh OAuth2 access token
 */
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

/**
 * Create secure OAuth2 transporter
 */
const createSecureOAuthTransporter = async (accountId = 'default') => {
  try {
    const tokens = await getValidAccessToken('gmail', accountId);
    
    return nodemailer.createTransporter({
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

/**
 * Initialize OAuth tokens
 */
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

/**
 * Test OAuth setup
 */
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

/**
 * Revoke OAuth tokens
 */
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