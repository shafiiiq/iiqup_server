var express = require('express');
var router = express.Router();
const userController = require('../controllers/users.controllers');
const overtimeUpload = require('../multer/overtime-upload'); // Import the multer config
const { authMiddleware } = require('../utils/jwt');

/* GET users listing. */
router.post('/addusers', userController.addUsers);
router.get('/allusers', userController.getUsers);
router.put('/updateuser/:id', userController.updateUser);
router.delete('/deleteuser/:id', userController.deleteUser);

//verify the ceo 
router.post('/verify-ceo', userController.verifyCEO);

// Updated route with multer middleware for overtime requests
router.post('/request-grant/:mechanicId/overtime', userController.requestGrant);

// Keep the original route for non-overtime requests    
router.post('/request-service', userController.requestService);

router.post('/grant-access', userController.grantAccess);
router.post('/get-grantaccess-data', userController.getGrantAccessData);
router.delete('/delete-special-notification/:id', userController.deleteSpecialNotification);

// New endpoints for authentication
router.post('/verify-user', userController.verifyUser);
router.post('/update-auth-mail', userController.updateAuthMail);  // Optional endpoint to update phone number

// special notification 
router.post('/get-special-notification', userController.getSpecialNotification);


// push notifications <<<<<<<<<<<<<<<<<< ----------------------------------- >>>>>>>>>>>>>>>>>>>>
// Register push token
router.post('/register-push-token', userController.addPushToken);

// Remove push token (for logout)
router.post('/remove-push-token', userController.removePushToken);

// Get user's push tokens
router.post('/get-push-tokens', userController.getUserPushTokens);

// Send test notification
router.post('/send-test-notification', userController.sendTestNotification);

router.get('/get-user-roles', authMiddleware, userController.getUserRoles)

module.exports = router;