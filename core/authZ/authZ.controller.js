const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const userService = require('#features/user/staff/staff.service')
const authZServices = require('./authZ.service')


const verifyDocAuthUser = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Password is required' });

    const result = await userService.verifyDocAuthUserCreds(password);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] verifyDocAuthUser', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Authentication failed' });
  }
};

const registerMobileSigningKey = async (req, res) => {
  try {
    const { deviceId, signingKey } = req.body;
    const result = await authZServices.registerMobileSigningKey(req.user.id, deviceId, signingKey);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] registerMobileSigningKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerMobileSigningKey,
  verifyDocAuthUser,
};