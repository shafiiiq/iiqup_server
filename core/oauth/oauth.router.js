const express = require('express')
const controller = require('./oauth.controller')
const linkController = require('./oauth.link.controller')
const emailController = require('./oauth.email.controller')
const { authMiddleware } = require('#middlewares/jwt.middleware')

const router = express.Router()

router.get('/links', authMiddleware, linkController.listLinkedProviders)
router.post('/links', authMiddleware, linkController.linkProviderToAccount)
router.delete('/links/:provider', authMiddleware, linkController.unlinkProviderFromAccount)
router.post('/link/staff/request', linkController.requestStaffLinkOtp)
router.post('/link/staff/verify', linkController.verifyStaffLinkOtp)
router.post('/link/confirm', linkController.confirmSocialLink)
router.post('/link/qatar', linkController.linkWithQatarId)
router.post('/email/request', emailController.requestEmailOtp)
router.post('/email/verify', emailController.verifyEmailOtp)
router.post('/email/complete', emailController.completeEmailLogin)
router.post('/:provider', controller.socialLogin)

module.exports = router