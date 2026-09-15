const express = require('express');
const router = express.Router();

const controller = require('./authZ.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.post('/activate-signature', authMiddleware, controller.activateSignature);
router.post('/six-digit-auth/verify', authMiddleware, controller.verifyDocAuthUser);
router.post('/sign-key/wm', authMiddleware, controller.getSignWmKey);
router.post('/sign-key/accounts', authMiddleware, controller.getSignAccountsKey);
router.post('/sign-key', authMiddleware, controller.getSignKey);
router.post('/sign-key/pm', authMiddleware, controller.getSignPmKey);
router.post('/sign-key/manager', authMiddleware, controller.getSignManagerKey);
router.post('/sign-key/authorized', authMiddleware, controller.getSignAuthorizedKey);
router.post('/sign-key/seal', authMiddleware, controller.getSealKey);

module.exports = router;