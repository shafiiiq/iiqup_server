var express = require('express');
var router = express.Router();
const userController = require('../controllers/users.controllers');
const overtimeUpload = require('../multer/overtime-upload'); // Import the multer config
const { authMiddleware } = require('../utils/jwt');

router.post('/addusers', userController.addUsers);
router.get('/allusers', authMiddleware, userController.getUsers);
router.get('/get-all-users', authMiddleware, userController.getAllUsers);
router.put('/updateuser/:id', authMiddleware, userController.updateUser);
router.delete('/deleteuser/:id', authMiddleware, userController.deleteUser);
router.post('/verify-ceo', userController.verifyCEO);
router.post('/request-grant/:mechanicId/overtime', authMiddleware, userController.requestGrant);
router.post('/request-service', userController.requestService);
router.post('/grant-access', authMiddleware, userController.grantAccess);
router.post('/get-grantaccess-data', authMiddleware, userController.getGrantAccessData);
router.delete('/delete-special-notification/:id', authMiddleware, userController.deleteSpecialNotification);
router.post('/verify-user', userController.verifyUser);
router.post('/change-password', userController.changePassword);
router.post('/reset-password', userController.resetPassword);
router.post('/update-auth-mail', userController.updateAuthMail);  // Optional endpoint to update phone number
router.post('/get-special-notification', userController.getSpecialNotification);
router.post('/register-push-token', userController.addPushToken);
router.post('/remove-push-token', userController.removePushToken);
router.post('/get-push-tokens', userController.getUserPushTokens);
router.post('/send-test-notification', userController.sendTestNotification);
router.get('/get-user-roles', authMiddleware, userController.getUserRoles)
router.post('/six-digit-auth/verify', authMiddleware, userController.verifyDocAuthUser)

router.post('/doc-0auth-sign-key', authMiddleware, userController.getSignKey)
router.post('/doc-0auth-pm-sign-key', authMiddleware, userController.getSignPmKey)
router.post('/doc-0auth-accounts-sign-key', authMiddleware, userController.getSignAccountsKey)
router.post('/doc-0auth-manager-sign-key', authMiddleware, userController.getSignManagerKey)
router.post('/doc-0auth-authorized-sign-key', authMiddleware, userController.getSignAuthorizedKey)
router.post('/doc-0auth-seal-sign-key', authMiddleware, userController.getSealKey)

router.post('/activate-signature', authMiddleware, userController.activateSignature);
router.post('/verify-device-trust', authMiddleware, userController.verifyDeviceTrust);

router.get('/verify-token', authMiddleware, (req, res) => {
    // If authMiddleware passes, token is valid
    res.status(200).json({
        success: true,
        valid: true,
        message: 'Token is valid'
    });
});

// Session routes (all require authentication)
router.get('/sessions', authMiddleware, userController.getUserSessions);
router.delete('/sessions/:sessionId', authMiddleware, userController.logoutSession);
router.post('/sessions/:sessionId/block', authMiddleware, userController.blockDevice);
router.delete('/sessions/logout-all', authMiddleware, userController.logoutAllSessions);
module.exports = router;