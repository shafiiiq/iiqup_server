// services/signature.service.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User   = require('../models/user.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM      = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.DEVICE_ENCRYPTION_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Encryption Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getEncryptionKey = () => {
  if (!ENCRYPTION_KEY) throw new Error('DEVICE_ENCRYPTION_KEY is not set');
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) return Buffer.from(ENCRYPTION_KEY, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes');
  return key;
};

const encryptDeviceData = (data) => {
  if (!data) throw new Error('Data to encrypt cannot be empty');
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted    = cipher.update(String(data).trim(), 'utf8', 'hex');
  encrypted       += cipher.final('hex');
  return { encryptedData: encrypted, iv: iv.toString('hex') };
};

const decryptAndVerifyDeviceData = (encryptedData, iv, originalData) => {
  try {
    if (!encryptedData || !iv || !originalData) return false;
    const decipher   = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(iv, 'hex'));
    let decrypted    = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted       += decipher.final('utf8');
    return decrypted.trim() === String(originalData).trim();
  } catch (error) {
    console.error('[SignatureService] decryptAndVerifyDeviceData:', error.message);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Device Trust
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activates signature access for a user and trusts their device.
 * @param {string} userId
 * @param {string} activationKey
 * @param {string} signType
 * @param {object} deviceInfo
 * @returns {Promise}
 */
const activateSignatureAccess = async (userId, activationKey, signType, deviceInfo) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: 'User not found' };

    const signActivation = user.signatureActivation.find(s => s.signType === signType);
    if (!signActivation) throw { status: 404, message: 'Signature type not configured for this user' };

    const isKeyValid = await bcrypt.compare(activationKey, signActivation.activationKey);
    if (!isKeyValid) throw { status: 401, message: 'Invalid activation key' };

    const { deviceFingerprint, ipAddress, location, userAgent, browserInfo } = deviceInfo;
    if (!deviceFingerprint || !ipAddress || !location || !userAgent || !browserInfo) {
      throw { status: 400, message: 'Incomplete device information' };
    }

    const encFingerprint = encryptDeviceData(deviceFingerprint);
    const encIp          = encryptDeviceData(ipAddress);
    const encLocation    = encryptDeviceData(location);
    const encUserAgent   = encryptDeviceData(userAgent);
    const encBrowser     = encryptDeviceData(browserInfo);

    const existingDeviceIndex = signActivation.trustedDevices.findIndex(d => {
      if (!d.isActive) return false;
      return decryptAndVerifyDeviceData(d.uniqueCode, d.uniqueCodeIv, deviceFingerprint) &&
             decryptAndVerifyDeviceData(d.ipAddress, d.ipAddressIv, ipAddress) &&
             decryptAndVerifyDeviceData(d.userAgent, d.userAgentIv, userAgent) &&
             decryptAndVerifyDeviceData(d.browserInfo, d.browserInfoIv, browserInfo) &&
             decryptAndVerifyDeviceData(d.location, d.locationIv, location);
    });

    if (existingDeviceIndex !== -1) {
      signActivation.trustedDevices[existingDeviceIndex].lastUsed = new Date();
      signActivation.trustedDevices[existingDeviceIndex].isActive = true;
    } else {
      signActivation.trustedDevices.push({
        uniqueCode: encFingerprint.encryptedData, uniqueCodeIv: encFingerprint.iv,
        ipAddress:  encIp.encryptedData,          ipAddressIv:  encIp.iv,
        location:   encLocation.encryptedData,    locationIv:   encLocation.iv,
        userAgent:  encUserAgent.encryptedData,   userAgentIv:  encUserAgent.iv,
        browserInfo: encBrowser.encryptedData,    browserInfoIv: encBrowser.iv,
        activatedAt: new Date(), lastUsed: new Date(), isActive: true
      });
    }

    signActivation.isActivated  = true;
    signActivation.activatedAt  = new Date();
    signActivation.activatedBy  = userId;
    await user.save();

    return { status: 200, message: 'Signature activated successfully', data: { signType, deviceTrusted: true } };
  } catch (error) {
    console.error('[SignatureService] activateSignatureAccess:', error);
    throw error;
  }
};

/**
 * Verifies if the current device is trusted for a given sign type.
 * @param {string} userId
 * @param {string} signType
 * @param {object} deviceInfo
 * @returns {Promise}
 */
const verifyTrustedDevice = async (userId, signType, deviceInfo) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: 'User not found' };

    const signActivation = user.signatureActivation.find(s => s.signType === signType);
    if (!signActivation || !signActivation.isActivated) return { status: 200, data: { isActivated: false, isTrusted: false } };

    const { deviceFingerprint, ipAddress, location, userAgent, browserInfo } = deviceInfo;
    if (!deviceFingerprint || !ipAddress || !location || !userAgent || !browserInfo) {
      throw { status: 400, message: 'Incomplete device information' };
    }

    const trustedDevice = signActivation.trustedDevices.find(d => {
      if (!d.isActive) return false;
      return decryptAndVerifyDeviceData(d.uniqueCode, d.uniqueCodeIv, deviceFingerprint) &&
             decryptAndVerifyDeviceData(d.ipAddress, d.ipAddressIv, ipAddress) &&
             decryptAndVerifyDeviceData(d.userAgent, d.userAgentIv, userAgent) &&
             decryptAndVerifyDeviceData(d.browserInfo, d.browserInfoIv, browserInfo) &&
             decryptAndVerifyDeviceData(d.location, d.locationIv, location);
    });

    if (!trustedDevice) return { status: 401, data: { isActivated: false, isTrusted: false } };

    trustedDevice.lastUsed = new Date();
    await user.save();

    return { status: 200, data: { isActivated: true, isTrusted: true } };
  } catch (error) {
    console.error('[SignatureService] verifyTrustedDevice:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign Keys
// ─────────────────────────────────────────────────────────────────────────────

const getSignKey = async (userId, signType, envKey, deviceInfo) => {
  const result = await verifyTrustedDevice(userId, signType, deviceInfo);
  if (!result.data.isTrusted) throw { status: 403, message: 'Device not trusted. Please activate signature access first.' };
  return { status: 200, data: { sign_key: process.env[envKey], expiresIn: 30 } };
};

const getAuthSignKey       = async (password) => {
  const { verifyDocAuthUserCreds } = require('./user.service.js');
  const response = await verifyDocAuthUserCreds(password);
  if (response.status !== 200) return { status: 500, message: 'Failed to fetch doc sign key', error: response.message };
  return { status: 200, data: { sign_key: process.env.DOC_SIGN_KEY } };
};

const getWmAuthSignKey         = (userId, deviceInfo) => getSignKey(userId, 'wm',         'WM_SIGN_KEY',         deviceInfo);
const getPmAuthSignKey         = (userId, deviceInfo) => getSignKey(userId, 'pm',         'PM_SIGN_KEY',         deviceInfo);
const getAccountsAuthSignKey   = (userId, deviceInfo) => getSignKey(userId, 'accounts',   'ACCOUNTS_SIGN_KEY',   deviceInfo);
const getManagerAuthSignKey    = (userId, deviceInfo) => getSignKey(userId, 'manager',    'MANAGER_SIGN_KEY',    deviceInfo);
const getAuthorizedAuthSignKey = (userId, deviceInfo) => getSignKey(userId, 'authorized', 'AUTHORIZED_SIGN_KEY', deviceInfo);
const getAuthSealKey           = (userId, deviceInfo) => getSignKey(userId, 'seal',       'SEAL_KEY',            deviceInfo);

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  encryptDeviceData,
  decryptAndVerifyDeviceData,
  activateSignatureAccess,
  verifyTrustedDevice,
  getAuthSignKey,
  getWmAuthSignKey,
  getPmAuthSignKey,
  getAccountsAuthSignKey,
  getManagerAuthSignKey,
  getAuthorizedAuthSignKey,
  getAuthSealKey,
};