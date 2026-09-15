const express = require('express');
const router = express.Router();

const controller = require('./authN.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.post('/verify/user', controller.verifyUser);
router.post('/refresh', controller.verifyRefresh);
router.put('/password', controller.changePassword);
router.put('/password/reset', controller.resetPassword);
router.put('/email', controller.updateAuthMail);
router.post('/generate/biometric-token', controller.generateBiometricToken);
router.post('/revoke/biometric-token', controller.revokeBiometricToken);
router.post('/biometric-login', controller.biometricLogin);
router.post('/verify/device-trust', authMiddleware, controller.verifyDeviceTrust);
router.get('/verify/token', authMiddleware, controller.checkTokenValidity);
router.get('/sessions', authMiddleware, controller.getUserSessions);
router.post('/sessions/:sessionId/block', authMiddleware, controller.blockDevice);
router.delete('/sessions/logout/all', authMiddleware, controller.logoutAllSessions);
router.delete('/sessions/:sessionId', authMiddleware, controller.logoutSession);

module.exports = router;