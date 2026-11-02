const express = require('express')
const controller = require('./signup.controller')
const { authMiddleware } = require('#middlewares/jwt.middleware')
const { requireRoles } = require('#middlewares/role.middleware')
const { USER_ROLES } = require('#features/user/staff/staff.constant')

const router = express.Router()

const signupAdminOnly = requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.SUB_ADMIN)

router.post('/requests', controller.createSignupRequest)
router.get('/requests/:requestId/status', controller.getSignupRequestStatus)
router.get('/requests', authMiddleware, signupAdminOnly, controller.listPendingSignupRequests)
router.post('/requests/:requestId/approve', authMiddleware, signupAdminOnly, controller.approveSignupRequest)
router.post('/requests/:requestId/reject', authMiddleware, signupAdminOnly, controller.rejectSignupRequest)

module.exports = router