// services/biometric.service.js
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const User   = require('../models/user.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates and stores a biometric token for a user device.
 * @param {string} uniqueCode
 * @param {object} deviceInfo
 * @returns {Promise}
 */
const generateBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });
    if (!user) return { success: false, message: 'User not found' };

    const biometricToken = crypto.randomBytes(64).toString('hex');
    const expiresAt      = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const existingTokenIndex = user.biometricTokens.findIndex(t => t.deviceInfo.deviceId === deviceInfo.deviceId);

    if (existingTokenIndex !== -1) {
      user.biometricTokens[existingTokenIndex] = { token: biometricToken, deviceInfo, createdAt: new Date(), expiresAt, isActive: true, lastUsed: new Date() };
    } else {
      user.biometricTokens.push({ token: biometricToken, deviceInfo, expiresAt, isActive: true });
    }

    await user.save();
    return { success: true, data: { biometricToken, expiresAt, expiresIn: '90 days' } };
  } catch (error) {
    console.error('[BiometricService] generateBiometricToken:', error);
    return { success: false, message: 'Failed to generate biometric token', error: error.message };
  }
};

/**
 * Revokes biometric tokens for a specific device or all devices.
 * @param {string} uniqueCode
 * @param {object|null} deviceInfo
 * @returns {Promise}
 */
const revokeBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });
    if (!user) return { success: false, message: 'User not found' };

    if (deviceInfo?.deviceId) {
      const tokenIndex = user.biometricTokens.findIndex(t => t.deviceInfo.deviceId === deviceInfo.deviceId);
      if (tokenIndex !== -1) user.biometricTokens[tokenIndex].isActive = false;
    } else {
      user.biometricTokens.forEach(t => { t.isActive = false; });
    }

    await user.save();
    return { success: true, message: 'Biometric token revoked successfully' };
  } catch (error) {
    console.error('[BiometricService] revokeBiometricToken:', error);
    return { success: false, message: 'Failed to revoke biometric token', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs in a user using a biometric token.
 * @param {string} biometricToken
 * @param {object} deviceInfo
 * @returns {Promise}
 */
const biometricLogin = async (biometricToken, deviceInfo) => {
  try {
    const user = await User.findOne({ 'biometricTokens.token': biometricToken, 'biometricTokens.isActive': true });
    if (!user) return { success: false, message: 'Invalid biometric token' };

    const tokenData = user.biometricTokens.find(t => t.token === biometricToken && t.isActive);
    if (!tokenData) return { success: false, message: 'Token not found or inactive' };

    if (new Date() > tokenData.expiresAt) {
      tokenData.isActive = false;
      await user.save();
      return { success: false, message: 'Biometric token expired. Please login again.' };
    }

    if (tokenData.deviceInfo.deviceId !== deviceInfo.deviceId) {
      return { success: false, message: 'Device mismatch. Please login again.' };
    }

    tokenData.lastUsed = new Date();
    user.lastLogin     = new Date();
    await user.save();

    const { createSession } = require('./session.service.js');
    const deviceData = {
      deviceName:  deviceInfo?.deviceName  || 'Unknown Device',
      deviceModel: deviceInfo?.deviceModel || 'Unknown Model',
      deviceId:    deviceInfo?.deviceId    || 'Unknown ID',
      brand:       deviceInfo?.brand       || 'Unknown',
      osName:      deviceInfo?.osName      || 'Unknown OS',
      osVersion:   deviceInfo?.osVersion   || 'Unknown',
     platform:    deviceInfo?.platform    || 'Unknown',
     loginTime:   new Date().toISOString(),
    };
    const sessionToken = await createSession(user._id, 'User', deviceData, null);
    const auth0token    = jwt.sign({ userId: user._id, email: user.email, uniqueCode: user.uniqueCode }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refresh_token = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

    return {
      success: true,
      data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role, userType: user.userType, uniqueCode: user.uniqueCode, auth0token, refresh_token, sessionToken } }
    };
  } catch (error) {
    console.error('[BiometricService] biometricLogin:', error);
    return { success: false, message: 'Failed to login with biometric', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { generateBiometricToken, revokeBiometricToken, biometricLogin };