const express = require('express')
const controller = require('./admin.user.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')
const { requireRoles } = require('#middlewares/role.middleware')
const { USER_ROLES } = require('../staff/staff.constant')

const router = express.Router()

router.use(requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.SUB_ADMIN))

router.post('/staff/:id/reset-password', controller.resetStaffPassword)
router.get('/:kind', paginationMiddleware, controller.listUsers)
router.post('/:kind', controller.createUser)
router.get('/:kind/:id', controller.getUserDetails)
router.put('/:kind/:id', controller.updateUser)
router.delete('/:kind/:id', controller.deleteUser)

module.exports = router