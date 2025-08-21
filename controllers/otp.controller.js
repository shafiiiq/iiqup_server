const otpServices = require('../services/otp-services');

/**
 * Controller to request an OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestOTP = async (req, res) => {
  let { email } = req.body;

  if (email === 'DOCUMENT_VERIFIER_AUTH_MAIL') {
    email = process.env.AUTH_OTP_USER_EMAIL
  }

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required'
    });
  }

  try {
    const result = await otpServices.generateAndSendOTP(email);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to request OTP',
      error: err.message
    });
  }
};

/**
 * Controller to verify an OTP
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyOTP = async (req, res) => {
  const { otp } = req.body;
  let { email, type } = req.body;

  if (email === 'DOCUMENT_VERIFIER_AUTH_MAIL') {
    email = process.env.AUTH_OTP_USER_EMAIL
    type = 'office'
  }

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: 'Email and OTP are required'
    });
  }

  try {
    const result = await otpServices.verifyOTP(email, otp, type, type === 'operator' ? req.body.qatarId : null);

    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: err.message
    });
  }
};

/**
 * Controller to reset password using OTP 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, OTP, and new password are required'
    });
  }

  // Password strength validation
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password should be at least 6 characters long'
    });
  }

  try {
    const result = await otpServices.resetPasswordWithOTP(email, otp, newPassword);
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: err.message
    });
  }
};

module.exports = {
  requestOTP,
  verifyOTP,
  resetPassword
};