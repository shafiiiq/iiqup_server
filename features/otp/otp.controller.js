const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const otpServices = require('./otp.service');
const { DOCUMENT_VERIFIER_ALIAS } = require('./otp.constant');

const resolveEmail = (email) =>
  email === DOCUMENT_VERIFIER_ALIAS ? process.env.AUTH_OTP_USER_EMAIL : email;

const requestOTP = async (req, res) => {
  try {
    const email = resolveEmail(req.body.email);

    if (!email) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Email address is required' });
    }

    const result = await otpServices.generateAndSendOTP(email);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[otp.controller] requestOTP', error);
    sendError(res, { success: false, message: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { otp, qatarId } = req.body;
    const emailInput = req.body.email || req.body.authMail || req.body.authMailAddress;

    const isVerifier = emailInput === DOCUMENT_VERIFIER_ALIAS;
    const email = resolveEmail(emailInput);
    const type = isVerifier ? 'staff' : req.body.userType;

    if (!email || !otp) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Email and OTP are required' });
    }

    const result = await otpServices.verifyOTP(email, otp, type, type === 'operator' ? qatarId : null);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[otp.controller] verifyOTP', error);
    sendError(res, { success: false, message: error.message });
  }
};

module.exports = {
  requestOTP,
  verifyOTP,
};