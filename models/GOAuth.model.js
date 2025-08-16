// models/GOAuth.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const oAuthSchema = new mongoose.Schema({
  service: {
    type: String,
    required: true,
    enum: ['gmail', 'outlook', 'smtp'],
    unique: true
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

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY ? 
  Buffer.from(process.env.OAUTH_ENCRYPTION_KEY, 'hex') : 
  crypto.randomBytes(32); // 32 bytes key

/**
 * Encrypt sensitive data using AES-256-CBC
 */
const encrypt = (text) => {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(16); // 16 bytes IV for AES
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + Encrypted data (both in hex)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption failed:', error.message);
    return null;
  }
};

/**
 * Decrypt sensitive data using AES-256-CBC
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;
  
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted data format');
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
};

// Static methods for token management
oAuthSchema.statics.saveTokens = async function(service, tokens) {
  const encryptedData = {
    service,
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    encryptedAccessToken: tokens.access_token ? encrypt(tokens.access_token) : null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    clientId: tokens.client_id,
    encryptedClientSecret: encrypt(tokens.client_secret),
    lastUsed: new Date(),
    updatedAt: new Date()
  };

  return await this.findOneAndUpdate(
    { service },
    encryptedData,
    { upsert: true, new: true }
  );
};

oAuthSchema.statics.getTokens = async function(service) {
  const record = await this.findOne({ service, isActive: true });
  
  if (!record) {
    throw new Error(`No active tokens found for service: ${service}`);
  }

  // Check if access token is expired
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

oAuthSchema.statics.updateAccessToken = async function(service, accessToken, expiryDate) {
  return await this.findOneAndUpdate(
    { service, isActive: true },
    {
      encryptedAccessToken: encrypt(accessToken),
      tokenExpiry: new Date(expiryDate),
      lastUsed: new Date(),
      updatedAt: new Date()
    },
    { new: true }
  );
};

oAuthSchema.statics.revokeTokens = async function(service) {
  return await this.findOneAndUpdate(
    { service },
    {
      isActive: false,
      updatedAt: new Date()
    },
    { new: true }
  );
};

// Middleware to update lastUsed on any query
oAuthSchema.pre('findOne', function() {
  this.populate = false; // Prevent population for security
});

module.exports = mongoose.model('GOAuth', oAuthSchema);