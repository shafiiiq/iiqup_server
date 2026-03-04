// services/otp.service.js
const crypto  = require('crypto');
const bcrypt  = require('bcrypt');
const OTP     = require('../models/otp.model');
const User    = require('../models/user.model');
const Mechanic = require('../models/mechanic.model');
const Operator = require('../models/operator.model');
const emailService       = require('../gmail/otp.gmail');
const { generateTokens } = require('../utils/jwt.utils');

const OTP_SALT_ROUNDS  = 12;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LENGTH       = 6;
const OTP_EXPIRY_MINUTES = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateSecureOTP = () => {
  const num = crypto.randomBytes(4).readUInt32BE(0);
  return (num % 900000 + 100000).toString();
};

const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(OTP_SALT_ROUNDS);
  return bcrypt.hash(otp, salt);
};

const verifyOTPHash = async (plain, hashed) => bcrypt.compare(plain, hashed);

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a secure OTP, stores it hashed, and sends it to the user's email.
 * @param {string} email
 * @param {boolean} demo_opr
 * @param {string} name
 * @returns {Promise}
 */
const generateAndSendOTP = async (email, demo_opr = false, name) => {
  try {
    if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
      return { status: 400, success: false, message: 'Valid email address is required' };
    }

    let user = await User.findOne({ authMail: email });
    if (!user) user = await Mechanic.findOne({ authMail: email });
    if (!user) return { status: 404, success: false, message: 'No user found with this email address' };

    const otp       = generateSecureOTP();
    const hashedOTP = await hashOTP(otp);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await OTP.findOneAndUpdate(
      { email },
      { email, otp: hashedOTP, expiresAt, verified: false, attempts: 0, createdAt: new Date() },
      { upsert: true, new: true }
    );

    if (demo_opr) {
      await emailService.sendOTPEmail(email, otp, name, true);
    } else {
      await emailService.sendOTPEmail(email, otp, user.name);
    }

    const isDemoAccount  = process.env.DEMO_OFFICE == user.email || process.env.DEMO_MECHANIC == user.email || demo_opr;
    const isDevelopment  = process.env.NODE_ENV === 'development';
    const exposeOTP      = isDemoAccount || isDevelopment;

    return {
      status: 200,
      success: true,
      message: 'OTP sent successfully to your email',
      otp: exposeOTP ? otp : null,
      data: {
        email,
        expiresAt,
        ...(isDevelopment && { otp }),
      },
    };
  } catch (error) {
    console.error('Error generating OTP:', error);
    return { status: 500, success: false, message: 'Failed to generate OTP', error: error.message };
  }
};

/**
 * Verifies a submitted OTP and returns auth tokens on success.
 * @param {string} email
 * @param {string} otp
 * @param {string} type - 'mechanic' | 'operator' | 'office'
 * @param {string} qatarId
 * @returns {Promise}
 */
const verifyOTP = async (email, otp, type, qatarId = null) => {
  try {
    if (!otp || otp.length !== OTP_LENGTH) {
      return { status: 400, success: false, message: 'Invalid OTP format' };
    }

    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) return { status: 404, success: false, message: 'Invalid OTP' };

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return { status: 400, success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (otpRecord.verified) {
      return { status: 400, success: false, message: 'OTP has already been used' };
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email });
      return { status: 429, success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    const isValid = await verifyOTPHash(otp, otpRecord.otp);

    if (!isValid) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();
      const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      return { status: 400, success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    let user;
    if (type === 'mechanic') {
      user = await Mechanic.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    } else if (type === 'operator') {
      user = await Operator.findOne({ qatarId }).select('_id name uniqueCode userType equipmentNumber qatarId');
    } else {
      user = await User.findOne({ authMail: email }).select('_id name email role uniqueCode userType');
    }

    if (!user) return { status: 404, success: false, message: 'User not found' };

    const _auth_tokens = generateTokens({
      _id: user._id,
      email: type === 'operator' ? qatarId : user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
    });

    await OTP.deleteOne({ email });

    return {
      status: 200,
      success: true,
      message: 'OTP verified successfully',
      authorized: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          userType: user.userType,
          uniqueCode: user.uniqueCode,
          equipmentNumber: user.equipmentNumber || null,
          qatarId: user.qatarId || null,
          auth0token: _auth_tokens.accessToken,
          refresh_token: _auth_tokens.refreshToken,
        },
      },
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { status: 500, success: false, message: 'Failed to verify OTP', error: error.message };
  }
};

/**
 * Verifies OTP and resets the user's password.
 * @param {string} email
 * @param {string} otp
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPasswordWithOTP = async (email, otp, newPassword) => {
  try {
    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) return { status: 404, success: false, message: 'No OTP found for this email address' };

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return { status: 400, success: false, message: 'OTP has expired. Please request a new one.' };
    }

    if (otpRecord.verified) {
      return { status: 400, success: false, message: 'OTP has already been used' };
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ email });
      return { status: 429, success: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.' };
    }

    const isValid = await verifyOTPHash(otp, otpRecord.otp);

    if (!isValid) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();
      const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      return { status: 400, success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }

    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await User.findOneAndUpdate(
      { authMail: email },
      { password: hashedPassword, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!updatedUser) return { status: 404, success: false, message: 'User not found' };

    await OTP.deleteOne({ email });

    return {
      status: 200,
      success: true,
      message: 'Password reset successfully',
      data: { _id: updatedUser._id, email: updatedUser.authMail },
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { status: 500, success: false, message: 'Failed to reset password', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { generateAndSendOTP, verifyOTP, resetPasswordWithOTP };