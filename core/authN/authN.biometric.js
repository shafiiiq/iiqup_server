// authN.biometric.js
const logger = require('#shared/logger/logger');
const crypto = require('crypto');
const User = require('#features/user/staff/staff.model');
const { createSession } = require('../session/session.service');
const { generateAuthTokens } = require('#middlewares/jwt.middleware');

const generateBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });
    if (!user) return { success: false, message: 'User not found' };

    const biometricToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const existingTokenIndex = user.biometricTokens.findIndex(
      (t) => t.deviceInfo.deviceId === deviceInfo.deviceId
    );

    if (existingTokenIndex !== -1) {
      user.biometricTokens[existingTokenIndex] = {
        token: biometricToken,
        deviceInfo,
        createdAt: new Date(),
        expiresAt,
        isActive: true,
        lastUsed: new Date(),
      };
    } else {
      user.biometricTokens.push({
        token: biometricToken,
        deviceInfo,
        expiresAt,
        isActive: true,
      });
    }

    await user.save();
    return { success: true, data: { biometricToken, expiresAt, expiresIn: '90 days' } };
  } catch (error) {
    logger.error('[authN.biometric] generateBiometricToken', error);
    return { success: false, message: 'Failed to generate biometric token', error: error.message };
  }
};

const revokeBiometricToken = async (uniqueCode, deviceInfo) => {
  try {
    const user = await User.findOne({ uniqueCode });
    if (!user) return { success: false, message: 'User not found' };

    if (deviceInfo?.deviceId) {
      const tokenIndex = user.biometricTokens.findIndex(
        (t) => t.deviceInfo.deviceId === deviceInfo.deviceId
      );
      if (tokenIndex !== -1) user.biometricTokens[tokenIndex].isActive = false;
    } else {
      user.biometricTokens.forEach((t) => {
        t.isActive = false;
      });
    }

    await user.save();
    return { success: true, message: 'Biometric token revoked successfully' };
  } catch (error) {
    logger.error('[authN.biometric] revokeBiometricToken', error);
    return { success: false, message: 'Failed to revoke biometric token', error: error.message };
  }
};

const biometricLogin = async (biometricToken, deviceInfo) => {
  try {
    const user = await User.findOne({
      'biometricTokens.token': biometricToken,
      'biometricTokens.isActive': true,
    });
    if (!user) return { success: false, message: 'Invalid biometric token' };

    const tokenData = user.biometricTokens.find((t) => t.token === biometricToken && t.isActive);
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
    user.lastLogin = new Date();
    await user.save();

    const deviceData = {
      deviceName: deviceInfo?.deviceName || 'Unknown Device',
      deviceModel: deviceInfo?.deviceModel || 'Unknown Model',
      deviceId: deviceInfo?.deviceId || 'Unknown ID',
      brand: deviceInfo?.brand || 'Unknown',
      osName: deviceInfo?.osName || 'Unknown OS',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      platform: deviceInfo?.platform || 'Unknown',
      loginTime: new Date().toISOString(),
    };
    const sessionToken = await createSession(user._id, 'User', deviceData, null);

    const tokens = generateAuthTokens({
      _id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
    });

    return {
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          uniqueCode: user.uniqueCode,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionToken,
      },
    };
  } catch (error) {
    logger.error('[authN.biometric] biometricLogin', error);
    return { success: false, message: 'Failed to login with biometric', error: error.message };
  }
};

module.exports = {
  generateBiometricToken,
  revokeBiometricToken,
  biometricLogin,
};