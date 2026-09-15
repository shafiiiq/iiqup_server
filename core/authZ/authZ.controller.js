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

const getSignKey = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Password is required' });

    const result = await authZServices.getAuthSignKey(password);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const getSignWmKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await authZServices.getWmAuthSignKey(deviceInfo.userId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignWmKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get WM sign key' });
  }
};

const getSignPmKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await authZServices.getPmAuthSignKey(deviceInfo.userId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignPmKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get PM sign key' });
  }
};

const getSignAccountsKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await authZServices.getAccountsAuthSignKey(deviceInfo.userId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignAccountsKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get Accounts sign key' });
  }
};

const getSignManagerKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await authZServices.getManagerAuthSignKey(deviceInfo.userId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignManagerKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get Manager sign key' });
  }
};

const getSignAuthorizedKey = async (req, res) => {
  try {
    const { deviceInfo, authRole } = req.body;
    const result = await authZServices.getAuthorizedAuthSignKey(deviceInfo.userId, deviceInfo, authRole);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSignAuthorizedKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get Authorized sign key' });
  }
};

const getSealKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await authZServices.getAuthSealKey(deviceInfo.userId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] getSealKey', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Cannot get Seal key' });
  }
};

const activateSignature = async (req, res) => {
  try {
    const { activationKey, signType, deviceInfo } = req.body;
    if (!activationKey || !signType || !deviceInfo) {
      return sendError(res, { success: false, message: 'activationKey, signType, and deviceInfo are required' });
    }

    const result = await authZServices.activateSignatureAccess(deviceInfo.userId, activationKey, signType, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authZ.controller] activateSignature', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Signature activation failed' });
  }
};

module.exports = {
  verifyDocAuthUser,
  getSignKey,
  getSignWmKey,
  getSignPmKey,
  getSignAccountsKey,
  getSignManagerKey,
  getSignAuthorizedKey,
  getSealKey,
  activateSignature,
};