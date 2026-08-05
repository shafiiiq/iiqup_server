const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/otp.controller.js
const otpServices = require('./otp.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DOCUMENT_VERIFIER_ALIAS = 'DOCUMENT_VERIFIER_AUTH_MAIL';

const resolveEmail = (email) =>
  email === DOCUMENT_VERIFIER_ALIAS ? process.env.AUTH_OTP_USER_EMAIL : email;

// ─────────────────────────────────────────────────────────────────────────────
// OTP Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /otp/request
 * Generates and sends an OTP to the given email address.
 */
const requestOTP = async (req, res) => {
  try {
    logger.info('req.body.email', req.body.email);
    logger.info('resolved email', resolveEmail(req.body.email));

    const email = resolveEmail(req.body.email);

    if (!email) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Email address is required' });
    }

    const result = await otpServices.generateAndSendOTP(email);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[OTP] requestOTP:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * POST /otp/verify
 * Verifies an OTP for the given email address.
 */
const verifyOTP = async (req, res) => {
  try {
    logger.info('otp verify req.body', req.body.otp);
    const { otp, qatarId } = req.body;
    const emailInput =
      req.body.email || req.body.authMail || req.body.authMailAddress;

    const isVerifier = emailInput === DOCUMENT_VERIFIER_ALIAS;
    const email = resolveEmail(emailInput);
    const type = isVerifier ? 'office' : req.body.type;

    if (!email || !otp) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Email and OTP are required' });
    }

    const result = await otpServices.verifyOTP(
      email,
      otp,
      type,
      type === 'operator' ? qatarId : null
    );

    logger.info('otp verify result', result);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[OTP] verifyOTP:', error);
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * POST /otp/reset-password
 * Resets a user's password after verifying their OTP.
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return sendError(res, {
        success: false,
        message: 'Email, OTP, and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return sendError(res, {
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const result = await otpServices.resetPasswordWithOTP(
      email,
      otp,
      newPassword
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[OTP] resetPassword:', error);
    sendError(res, { success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  requestOTP,
  verifyOTP,
  resetPassword,
};
