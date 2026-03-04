// routes/user.router.js
const express = require('express');
const router  = express.Router();

const controller         = require('../controllers/user.controller');
const { authMiddleware } = require('../utils/jwt.utils');

// ─────────────────────────────────────────────────────────────────────────────
// User Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get   ('/allusers',                           authMiddleware, controller.getUsers);
router.get   ('/get-all-users',                      authMiddleware, controller.getAllUsers);
router.get   ('/get-user-roles',                     authMiddleware, controller.getUserRoles);
router.post  ('/addusers',                                           controller.addUsers);
router.put   ('/updateuser/:id',                     authMiddleware, controller.updateUser);
router.delete('/deleteuser/:id',                     authMiddleware, controller.deleteUser);

// ── Authentication ────────────────────────────────────────────────────────────
router.post('/verify-user',                                          controller.verifyUser);
router.post('/verify-ceo',                                           controller.verifyCEO);
router.post('/change-password',                                      controller.changePassword);
router.post('/reset-password',                                       controller.resetPassword);
router.post('/update-auth-mail',                                     controller.updateAuthMail);
router.get ('/verify-token',                         authMiddleware, controller.verifyToken);

// ── Biometric ─────────────────────────────────────────────────────────────────
router.post('/generate-biometric-token',                             controller.generateBiometricToken);
router.post('/biometric-login',                                      controller.biometricLogin);
router.post('/revoke-biometric-token',                               controller.revokeBiometricToken);

// ── Sessions ──────────────────────────────────────────────────────────────────
router.get   ('/sessions',                           authMiddleware, controller.getUserSessions);
router.delete('/sessions/:sessionId',                authMiddleware, controller.logoutSession);
router.delete('/sessions/logout-all',                authMiddleware, controller.logoutAllSessions);
router.post  ('/sessions/:sessionId/block',          authMiddleware, controller.blockDevice);

// ── Push tokens ───────────────────────────────────────────────────────────────
router.post('/register-push-token',                                  controller.addPushToken);
router.post('/remove-push-token',                                    controller.removePushToken);
router.post('/get-push-tokens',                                      controller.getUserPushTokens);
router.post('/send-test-notification',                               controller.sendTestNotification);

// ── Special notifications ─────────────────────────────────────────────────────
router.post  ('/get-special-notification',                           controller.getSpecialNotification);
router.delete('/delete-special-notification/:id',    authMiddleware, controller.deleteSpecialNotification);

// ── Permissions ───────────────────────────────────────────────────────────────
router.post('/grant-access',                         authMiddleware, controller.grantAccess);
router.post('/get-grantaccess-data',                 authMiddleware, controller.getGrantAccessData);
router.post('/request-grant/:mechanicId/overtime',   authMiddleware, controller.requestGrant);
router.post('/request-service',                                      controller.requestService);

// ── Document signing ──────────────────────────────────────────────────────────
router.post('/six-digit-auth/verify',                authMiddleware, controller.verifyDocAuthUser);
router.post('/doc-oauth-sign-key',                   authMiddleware, controller.getSignKey);
router.post('/doc-oauth-wm-sign-key',                authMiddleware, controller.getSignWmKey);
router.post('/doc-oauth-pm-sign-key',                authMiddleware, controller.getSignPmKey);
router.post('/doc-oauth-accounts-sign-key',          authMiddleware, controller.getSignAccountsKey);
router.post('/doc-oauth-manager-sign-key',           authMiddleware, controller.getSignManagerKey);
router.post('/doc-oauth-authorized-sign-key',        authMiddleware, controller.getSignAuthorizedKey);
router.post('/doc-oauth-seal-sign-key',              authMiddleware, controller.getSealKey);
router.post('/activate-signature',                   authMiddleware, controller.activateSignature);
router.post('/verify-device-trust',                  authMiddleware, controller.verifyDeviceTrust);

module.exports = router;