const express = require('express');
const router = express.Router();

const controller = require('./authZ.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.post('/six-digit-auth/verify', authMiddleware, controller.verifyDocAuthUser);
router.post('/mobile-sign/register', authMiddleware, controller.registerMobileSigningKey);

module.exports = router;