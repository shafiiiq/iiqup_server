var express = require('express');
var router = express.Router();
const userController = require('../controllers/users.controllers');
const overtimeUpload = require('../multer/overtime-upload'); // Import the multer config
const { authMiddleware } = require('../utils/jwt');

router.post('/addusers', userController.addUsers);
router.get('/allusers', userController.getUsers);
router.put('/updateuser/:id', userController.updateUser);
router.delete('/deleteuser/:id', userController.deleteUser);
router.post('/verify-ceo', userController.verifyCEO);
router.post('/request-grant/:mechanicId/overtime', userController.requestGrant);   
router.post('/request-service', userController.requestService);
router.post('/grant-access', userController.grantAccess);
router.post('/get-grantaccess-data', userController.getGrantAccessData);
router.delete('/delete-special-notification/:id', userController.deleteSpecialNotification);
router.post('/verify-user', userController.verifyUser);
router.post('/update-auth-mail', userController.updateAuthMail);  // Optional endpoint to update phone number
router.post('/get-special-notification', userController.getSpecialNotification);
router.post('/register-push-token', userController.addPushToken);
router.post('/remove-push-token', userController.removePushToken);
router.post('/get-push-tokens', userController.getUserPushTokens);
router.post('/send-test-notification', userController.sendTestNotification);
router.get('/get-user-roles', userController.getUserRoles)
router.post('/six-digit-auth/verify', userController.verifyDocAuthUser)
router.post('/doc-0auth-sign-key', userController.getSignKey)

module.exports = router;