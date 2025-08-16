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

// Static methods - MUST be defined before creating the model
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

// Create and export the model
const GOAuth = mongoose.model('GOAuth', oAuthSchema);
module.exports = GOAuth;
