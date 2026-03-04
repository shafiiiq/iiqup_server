// controllers/otp.controller.js
const otpServices = require('../services/otp.service');

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
    const email = resolveEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const result = await otpServices.generateAndSendOTP(email);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[OTP] requestOTP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /otp/verify
 * Verifies an OTP for the given email address.
 */
const verifyOTP = async (req, res) => {
  try {
    const { otp, qatarId } = req.body;

    const isVerifier = req.body.email === DOCUMENT_VERIFIER_ALIAS;
    const email      = resolveEmail(req.body.email);
    const type       = isVerifier ? 'office' : req.body.type;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const result = await otpServices.verifyOTP(
      email,
      otp,
      type,
      type === 'operator' ? qatarId : null
    );

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[OTP] verifyOTP:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const result = await otpServices.resetPasswordWithOTP(email, otp, newPassword);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[OTP] resetPassword:', error);
    res.status(500).json({ success: false, message: error.message });
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