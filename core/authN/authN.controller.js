const logger = require('#shared/logger/logger')
const { resolveAuthHandler, resolveQatarLoginHandler, isQatarIdUserType } = require('./authN.resolver');
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const profileService = require('./authN.profile');
const services = {
  authN: require('./authN.service'),
  biometric: require('#core/authN/authN.biometric'),
  user: require('#features/user/staff/staff.service'),
  session: require('#core/session/session.service'),
}

const verifyUser = async (req, res) => {
  try {
    const { type, qatarId, email, password, deviceInfo } = req.body;
    const usesQatarId = isQatarIdUserType(type);

    if (usesQatarId && !qatarId) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Qatar ID is required' });
    }
    if (!usesQatarId && (!email || !password)) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Email and password are required' });
    }

    const authHandler = resolveAuthHandler(type);
    const result = usesQatarId
      ? await authHandler(qatarId)
      : await authHandler(email, password, deviceInfo);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] verifyUser', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Authentication failed' });
  }
};

const loginWithQatarId = async (req, res) => {
  try {
    const { type, qatarId, deviceInfo } = req.body;

    if (!isQatarIdUserType(type)) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Qatar ID login is only for operators and mechanics' });
    }
    if (!qatarId) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Qatar ID is required' });
    }

    const result = await resolveQatarLoginHandler(type)(qatarId, deviceInfo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] loginWithQatarId', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Login failed' });
  }
};

const verifyRefresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(res, { success: false, message: 'refreshToken is required' });
    }

    const result = await services.authN.authRefresh(refreshToken);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] verifyRefresh', error);
    sendError(res, { success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return sendError(res, { success: false, message: 'Email, current password, and new password are required' });
    }
    if (currentPassword === newPassword) {
      return sendError(res, { success: false, message: 'New password must be different from current password' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return sendError(res, { success: false, message: 'New password does not meet security requirements' });
    }

    const result = await services.user.changePassword(email, currentPassword, newPassword);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] changePassword', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Password change failed' });
  }
};

const changeOwnPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Current password and new password are required' });
    }
    if (currentPassword === newPassword) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'New password must be different from current password' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'New password does not meet security requirements' });
    }

    const result = await services.user.changePasswordById(req.user.id, currentPassword, newPassword);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] changeOwnPassword', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Password change failed' });
  }
};

const updateAuthMail = async (req, res) => {
  try {
    const { userId, authMail, type } = req.body;
    if (!userId || !authMail)
      return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'userId and authMail are required' });

    const result = await services.user.updateUserAuthMail(userId, authMail, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] updateAuthMail', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Email is required' });

    const result = await services.user.resetPassword(email, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] resetPassword', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Password reset failed' });
  }
};

const generateBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;
    if (!uniqueCode || !deviceInfo)
      return sendError(res, { success: false, message: 'uniqueCode and deviceInfo are required' });

    const result = await services.biometric.generateBiometricToken(uniqueCode, deviceInfo);
    sendSuccess(res, {
      success: result.success,
      message: result.success ? undefined : result.message,
      data: result.success ? result.data : undefined,
    });
  } catch (error) {
    logger.error('[authN.controller] generateBiometricToken', error);
    sendError(res, { success: false, message: error.message });
  }
};

const biometricLogin = async (req, res) => {
  try {
    const { biometricToken, deviceInfo } = req.body;
    if (!biometricToken || !deviceInfo)
      return sendError(res, { success: false, message: 'biometricToken and deviceInfo are required' });

    const result = await services.biometric.biometricLogin(biometricToken, deviceInfo);
    sendSuccess(res, {
      success: result.success,
      authorized: result.success,
      message: result.success ? 'Biometric login successful' : result.message,
      data: result.success ? result.data : undefined,
    });
  } catch (error) {
    logger.error('[authN.controller] biometricLogin', error);
    sendError(res, { success: false, message: error.message });
  }
};

const revokeBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;
    if (!uniqueCode) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'uniqueCode is required' });

    const result = await services.biometric.revokeBiometricToken(uniqueCode, deviceInfo);
    res.status(result.success ? HTTP.OK : HTTP.NOT_FOUND).json({ success: result.success, message: result.message });
  } catch (error) {
    logger.error('[authN.controller] revokeBiometricToken', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await profileService.getProfile(req.user.id, req.user.userType);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] getProfile', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const result = await profileService.updateProfile(req.user.id, req.user.userType, req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] updateProfile', error);
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

const checkTokenValidity = async (req, res) => {
  try {
    res.status(HTTP.OK).json({ success: true, valid: true, message: 'Token is valid' });
  } catch (error) {
    logger.error('[authN.controller] checkTokenValidity', error);
    sendError(res, { success: false, message: error.message });
  }
};

const getUserSessions = async (req, res) => {
  try {
    const result = await services.session.getUserSessions(req.user.id, req.headers['x-session-token']);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] getUserSessions', error);
    sendError(res, { success: false, message: error.message });
  }
};

const blockDevice = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Session ID is required' });

    const result = await services.session.blockDevice(sessionId, req.user.id, req.headers['x-session-token']);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] blockDevice', error);
    sendError(res, { success: false, message: error.message });
  }
};

const logoutAllSessions = async (req, res) => {
  try {
    const result = await services.session.logoutAllSessions(req.user.id, req.headers['x-session-token']);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] logoutAllSessions', error);
    sendError(res, { success: false, message: error.message });
  }
};

const logoutCurrentSession = async (req, res) => {
  try {
    const result = await services.session.logoutCurrentSession(req.user.id, req.headers['x-session-token']);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] logoutCurrentSession', error);
    sendError(res, { success: false, message: error.message });
  }
};

const logoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Session ID is required' });

    const result = await services.session.logoutSession(sessionId, req.user.id, req.headers['x-session-token']);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[authN.controller] logoutSession', error);
    sendError(res, { success: false, message: error.message });
  }
};

module.exports = {
  verifyRefresh,
  changePassword,
  updateAuthMail,
  resetPassword,
  generateBiometricToken,
  verifyUser,
  loginWithQatarId,
  logoutCurrentSession,
  biometricLogin,
  revokeBiometricToken,
  updateProfile,
  getProfile,
  changeOwnPassword,
  checkTokenValidity,
  getUserSessions,
  blockDevice,
  logoutAllSessions,
  logoutSession,
};