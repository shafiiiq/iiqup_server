// controllers/user.controller.js
const path = require('path');
const { putObject } = require('../aws/s3.aws');
require('dotenv').config();

const userService        = require('../services/user.service');
const sessionService     = require('../services/session.service');
const tokenService       = require('../services/token.service');
const permissionService  = require('../services/permission.service');
const signatureService   = require('../services/signature.service');
const biometricService   = require('../services/biometric.service');
const PushNotification   = require('../push/notification.push');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_ENV_KEYS = [
  'MECHANIC', 'MAINTENANCE_HEAD', 'OPERATOR', 'CAMP_BOSS', 'MECHANIC_HEAD',
  'SUPER_ADMIN', 'JALEEL_KA', 'WORKSHOP_MANAGER', 'SUB_ADMIN',
  'ASSISTANT_OFFICE_ADMIN', 'OFFICE_ADMIN', 'CEO', 'ACCOUNTANT',
  'PURCHASE_MANAGER', 'MD', 'MANAGER',
];

// ─────────────────────────────────────────────────────────────────────────────
// User CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/addusers
 * Adds a new user record.
 */
const addUsers = async (req, res) => {
  try {
    const result = await userService.insertUser(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] addUsers:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /user/allusers
 * Returns active user records.
 */
const getUsers = async (req, res) => {
  try {
    const result = await userService.fetchUsers();
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getUsers:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /user/get-all-users
 * Returns all user records including inactive.
 */
const getAllUsers = async (req, res) => {
  try {
    const result = await userService.fetchAllUsers();
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getAllUsers:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /user/updateuser/:id
 * Updates a user by ID.
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'User ID is required' });

    const result = await userService.userUpdate(id, req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] updateUser:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /user/deleteuser/:id
 * Deletes a user by ID.
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'User ID is required' });

    const result = await userService.userDelete(id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] deleteUser:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/verify-user
 * Verifies user credentials and returns an auth token.
 */
const verifyUser = async (req, res) => {
  try {
    const { email, password, type, deviceInfo } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const result = await userService.verifyUserCredentials(email, password, type, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] verifyUser:', error);
    res.status(error.status || 500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * POST /user/verify-ceo
 * Verifies CEO credentials by email.
 */
const verifyCEO = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const result = await userService.verifyCEOcreds(email);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] verifyCEO:', error);
    res.status(error.status || 500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * POST /user/six-digit-auth/verify
 * Verifies document authorizer credentials by password.
 */
const verifyDocAuthUser = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

    const result = await userService.verifyDocAuthUserCreds(password);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] verifyDocAuthUser:', error);
    res.status(error.status || 500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * GET /user/verify-token
 * Confirms the current auth token is valid.
 */
const verifyToken = async (req, res) => {
  try {
    res.status(200).json({ success: true, valid: true, message: 'Token is valid' });
  } catch (error) {
    console.error('[User] verifyToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/change-password
 * Changes a user's password after verifying their current one.
 */
const changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, current password, and new password are required' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password does not meet security requirements' });
    }

    const result = await userService.changePassword(email, currentPassword, newPassword);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] changePassword:', error);
    res.status(error.status || 500).json({ success: false, message: 'Password change failed' });
  }
};

/**
 * POST /user/reset-password
 * Resets a user's password to the default.
 */
const resetPassword = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const result = await userService.resetPassword(email, type);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] resetPassword:', error);
    res.status(error.status || 500).json({ success: false, message: 'Password reset failed' });
  }
};

/**
 * POST /user/update-auth-mail
 * Updates the authentication email for a user.
 */
const updateAuthMail = async (req, res) => {
  try {
    const { userId, authMail, type } = req.body;
    if (!userId || !authMail) return res.status(400).json({ success: false, message: 'userId and authMail are required' });

    const result = await userService.updateUserAuthMail(userId, authMail, type);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] updateAuthMail:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /user/get-user-roles
 * Returns all user role codes from environment variables.
 */
const getUserRoles = (req, res) => {
  const missingVars = ROLE_ENV_KEYS.filter(key => !process.env[key]);
  if (missingVars.length > 0) {
    return res.status(500).json({ success: false, message: 'Cannot get all roles', missingVariables: missingVars });
  }
  res.status(200).json({
    success: true,
    roles: Object.fromEntries(ROLE_ENV_KEYS.map(key => [key, process.env[key]])),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /user/sessions
 * Returns all active sessions for the authenticated user.
 */
const getUserSessions = async (req, res) => {
  try {
    const result = await sessionService.getUserSessions(req.user.id, req.headers.authorization?.split(' ')[1]);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getUserSessions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /user/sessions/:sessionId
 * Logs out a specific session for the authenticated user.
 */
const logoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session ID is required' });

    const result = await sessionService.logoutSession(sessionId, req.user.id, req.headers.authorization?.split(' ')[1]);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] logoutSession:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /user/sessions/logout-all
 * Logs out all sessions except the current one.
 */
const logoutAllSessions = async (req, res) => {
  try {
    const result = await sessionService.logoutAllSessions(req.user.id, req.headers.authorization?.split(' ')[1]);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] logoutAllSessions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/sessions/:sessionId/block
 * Blocks the device associated with a session.
 */
const blockDevice = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session ID is required' });

    const result = await sessionService.blockDevice(sessionId, req.user.id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] blockDevice:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Push Tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/register-push-token
 * Registers a push notification token for a user.
 */
const addPushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken, platform } = req.body;
    if (!uniqueCode || !pushToken) return res.status(400).json({ success: false, message: 'uniqueCode and pushToken are required' });
    if (platform && !['ios', 'android'].includes(platform)) return res.status(400).json({ success: false, message: 'Platform must be either ios or android' });

    const result = await tokenService.insertPushToken(uniqueCode, pushToken, platform);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.success ? 'Push token registered successfully' : result.message,
      data:    result.success ? result.data : undefined,
    });
  } catch (error) {
    console.error('[User] addPushToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/remove-push-token
 * Removes a push notification token for a user.
 */
const removePushToken = async (req, res) => {
  try {
    const { uniqueCode, pushToken } = req.body;
    if (!uniqueCode || !pushToken) return res.status(400).json({ success: false, message: 'uniqueCode and pushToken are required' });

    const result = await tokenService.removePushToken(uniqueCode, pushToken);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.success ? 'Push token removed successfully' : result.message,
    });
  } catch (error) {
    console.error('[User] removePushToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/get-push-tokens
 * Returns all push tokens registered for a user.
 */
const getUserPushTokens = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode) return res.status(400).json({ success: false, message: 'uniqueCode is required' });

    const result = await tokenService.getUserPushTokens(uniqueCode);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.success ? undefined : result.message,
      data:    result.success ? result.data : undefined,
    });
  } catch (error) {
    console.error('[User] getUserPushTokens:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/send-test-notification
 * Sends a test push notification to a user.
 */
const sendTestNotification = async (req, res) => {
  try {
    const { uniqueCode, title, message } = req.body;
    if (!uniqueCode) return res.status(400).json({ success: false, message: 'uniqueCode is required' });

    const result = await tokenService.sendNotificationToUser(uniqueCode, {
      title: title   || 'Test Notification',
      body:  message || 'This is a test notification',
      data:  { type: 'test', timestamp: new Date().toISOString() },
    });
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.success ? 'Test notification sent successfully' : result.message,
      data:    result.success ? result.data : undefined,
    });
  } catch (error) {
    console.error('[User] sendTestNotification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Special Notifications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/get-special-notification
 * Returns special notifications for a user.
 */
const getSpecialNotification = async (req, res) => {
  try {
    const { uniqueCode } = req.body;
    if (!uniqueCode) return res.status(400).json({ success: false, message: 'uniqueCode is required' });

    const result = await PushNotification.fetchSpecialNotification(uniqueCode);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSpecialNotification:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /user/delete-special-notification/:id
 * Deletes a special notification by ID.
 */
const deleteSpecialNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID is required' });

    const result = await PushNotification.deleteNotification(id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] deleteSpecialNotification:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Permissions (access requests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/request-grant/:mechanicId/overtime
 * Submits an overtime request on behalf of a mechanic.
 */
const requestGrant = async (req, res) => {
  try {
    const { mechanicId }                          = req.params;
    const { date, regNo, times, workDetails, files, ...rest } = req.body;

    if (!date || !regNo || !times || !workDetails) {
      return res.status(400).json({ success: false, message: 'date, regNo, times, and workDetails are required' });
    }
    if (!Array.isArray(times) || times.length === 0) {
      return res.status(400).json({ success: false, message: 'times must be a non-empty array' });
    }
    for (let i = 0; i < times.length; i++) {
      if (!times[i].in || !times[i].out) {
        return res.status(400).json({ success: false, message: `Time entry ${i + 1} is missing 'in' or 'out' time` });
      }
    }

    let filesWithUploadData = [];
    if (files && files.length > 0) {
      filesWithUploadData = await Promise.all(
        files.map(async (file) => {
          const ext           = path.extname(file.fileName);
          const finalFilename = `${mechanicId}-${Date.now()}${ext}`;
          const s3Key         = `overtime/${mechanicId}/${finalFilename}`;
          const uploadUrl     = await putObject(file.fileName, s3Key, file.mimeType);
          return { fileName: finalFilename, originalName: file.fileName, filePath: s3Key, mimeType: file.mimeType, type: file.mimeType.startsWith('video/') ? 'video' : 'photo', uploadUrl, uploadDate: new Date() };
        })
      );
    }

    const response = await permissionService.submitOvertimeRequest(mechanicId, 'overtime', { date, regNo, times, workDetails, ...rest, mediaFiles: filesWithUploadData, totalFiles: filesWithUploadData.length });

    res.status(response.status).json({ success: true, message: 'Pre-signed URLs generated', data: { uploadData: filesWithUploadData } });
  } catch (error) {
    console.error('[User] requestGrant:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/request-service
 * Submits a general service permission request (loan, leave, etc).
 */
const requestService = async (req, res) => {
  try {
    const result = await permissionService.submitRequest(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] requestService:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/grant-access
 * Approves a pending permission request.
 */
const grantAccess = async (req, res) => {
  try {
    const { uniqueCode, dataId, purpose } = req.body;
    if (!uniqueCode || !dataId || !purpose) return res.status(400).json({ success: false, message: 'uniqueCode, dataId, and purpose are required' });

    const result = await permissionService.approveRequest(uniqueCode, dataId, purpose);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] grantAccess:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/get-grantaccess-data
 * Returns pending permission requests for a user.
 */
const getGrantAccessData = async (req, res) => {
  try {
    const { uniqueCode, purpose } = req.body;
    if (!uniqueCode) return res.status(400).json({ success: false, message: 'uniqueCode is required' });

    const result = await permissionService.getPendingRequests(uniqueCode, purpose);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getGrantAccessData:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Signature & Sign Keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/doc-oauth-sign-key
 * Returns the auth sign key for a given password.
 */
const getSignKey = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

    const result = await signatureService.getAuthSignKey(password);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignKey:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/doc-oauth-wm-sign-key
 */
const getSignWmKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getWmAuthSignKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignWmKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get WM sign key' });
  }
};

/**
 * POST /user/doc-oauth-pm-sign-key
 */
const getSignPmKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getPmAuthSignKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignPmKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get PM sign key' });
  }
};

/**
 * POST /user/doc-oauth-accounts-sign-key
 */
const getSignAccountsKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getAccountsAuthSignKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignAccountsKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get Accounts sign key' });
  }
};

/**
 * POST /user/doc-oauth-manager-sign-key
 */
const getSignManagerKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getManagerAuthSignKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignManagerKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get Manager sign key' });
  }
};

/**
 * POST /user/doc-oauth-authorized-sign-key
 */
const getSignAuthorizedKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getAuthorizedAuthSignKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSignAuthorizedKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get Authorized sign key' });
  }
};

/**
 * POST /user/doc-oauth-seal-sign-key
 */
const getSealKey = async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    const result = await signatureService.getAuthSealKey(deviceInfo.userId, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getSealKey:', error);
    res.status(error.status || 500).json({ success: false, message: 'Cannot get Seal key' });
  }
};

/**
 * POST /user/activate-signature
 * Activates signature access for a user on a trusted device.
 */
const activateSignature = async (req, res) => {
  try {
    const { activationKey, signType, deviceInfo } = req.body;
    if (!activationKey || !signType || !deviceInfo) {
      return res.status(400).json({ success: false, message: 'activationKey, signType, and deviceInfo are required' });
    }

    const result = await signatureService.activateSignatureAccess(deviceInfo.userId, activationKey, signType, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] activateSignature:', error);
    res.status(error.status || 500).json({ success: false, message: 'Signature activation failed' });
  }
};

/**
 * POST /user/verify-device-trust
 * Verifies that the requesting device is trusted for signing.
 */
const verifyDeviceTrust = async (req, res) => {
  try {
    const { signType, deviceInfo } = req.body;
    if (!signType || !deviceInfo) {
      return res.status(400).json({ success: false, message: 'signType and deviceInfo are required' });
    }

    const result = await signatureService.verifyTrustedDevice(deviceInfo.userId, signType, deviceInfo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] verifyDeviceTrust:', error);
    res.status(error.status || 500).json({ success: false, message: 'Device verification failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Biometric
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /user/generate-biometric-token
 * Generates a biometric authentication token for a user's device.
 */
const generateBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;
    if (!uniqueCode || !deviceInfo) return res.status(400).json({ success: false, message: 'uniqueCode and deviceInfo are required' });

    const result = await biometricService.generateBiometricToken(uniqueCode, deviceInfo);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.success ? undefined : result.message,
      data:    result.success ? result.data : undefined,
    });
  } catch (error) {
    console.error('[User] generateBiometricToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/biometric-login
 * Authenticates a user via biometric token.
 */
const biometricLogin = async (req, res) => {
  try {
    const { biometricToken, deviceInfo } = req.body;
    if (!biometricToken || !deviceInfo) return res.status(400).json({ success: false, message: 'biometricToken and deviceInfo are required' });

    const result = await biometricService.biometricLogin(biometricToken, deviceInfo);
    res.status(result.success ? 200 : 401).json({
      success:    result.success,
      authorized: result.success,
      message:    result.success ? 'Biometric login successful' : result.message,
      data:       result.success ? result.data : undefined,
    });
  } catch (error) {
    console.error('[User] biometricLogin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /user/revoke-biometric-token
 * Revokes a biometric token for a user's device.
 */
const revokeBiometricToken = async (req, res) => {
  try {
    const { uniqueCode, deviceInfo } = req.body;
    if (!uniqueCode) return res.status(400).json({ success: false, message: 'uniqueCode is required' });

    const result = await biometricService.revokeBiometricToken(uniqueCode, deviceInfo);
    res.status(result.success ? 200 : 404).json({ success: result.success, message: result.message });
  } catch (error) {
    console.error('[User] revokeBiometricToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /users/tutorials
 * Returns all tutorial IDs the user has already completed.
 */
const getTutorials = async (req, res) => {
  try {
    const result = await userService.getTutorialsSeen(req.user.id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] getTutorials:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /users/tutorials/complete
 * Marks a tutorial as completed for the authenticated user.
 * Body: { tutorialId: string }
 */
const completeTutorial = async (req, res) => {
  try {
    const { tutorialId } = req.body;
    if (!tutorialId) {
      return res.status(400).json({ success: false, message: 'tutorialId is required' });
    }
    const result = await userService.completeTutorial(req.user.id, tutorialId);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[User] completeTutorial:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addUsers, getUsers, getAllUsers, updateUser, deleteUser,
  // Authentication
  verifyUser, verifyCEO, verifyDocAuthUser, verifyToken,
  // Password
  changePassword, resetPassword, updateAuthMail,
  // Roles
  getUserRoles,
  // Sessions
  getUserSessions, logoutSession, logoutAllSessions, blockDevice,
  // Push tokens
  addPushToken, removePushToken, getUserPushTokens, sendTestNotification,
  // Special notifications
  getSpecialNotification, deleteSpecialNotification,
  // Permissions
  requestGrant, requestService, grantAccess, getGrantAccessData,
  // Signatures & sign keys
  getSignKey, getSignWmKey, getSignPmKey, getSignAccountsKey,
  getSignManagerKey, getSignAuthorizedKey, getSealKey,
  activateSignature, verifyDeviceTrust,
  // Biometric
  generateBiometricToken, biometricLogin, revokeBiometricToken,
  // Tutorials & Explores
  getTutorials,completeTutorial
};