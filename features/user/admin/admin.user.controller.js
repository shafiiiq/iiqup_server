const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const adminUserService = require('./admin.user.service')

const handleAdminUserRoute = (logTag, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req))
  } catch (error) {
    logger.error(`[admin.user.controller] ${logTag}`, error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const listUsers = handleAdminUserRoute('listUsers', (req) =>
  adminUserService.listUsers(req.params.kind, req.pagination)
)

const getUserDetails = handleAdminUserRoute('getUserDetails', (req) =>
  adminUserService.getUserDetails(req.params.kind, req.params.id)
)

const createUser = handleAdminUserRoute('createUser', (req) =>
  adminUserService.createUser(req.params.kind, req.body)
)

const deleteUser = handleAdminUserRoute('deleteUser', (req) =>
  adminUserService.deleteUser(req.params.kind, req.params.id, req.user.id)
)

const resetStaffPassword = handleAdminUserRoute('resetStaffPassword', (req) =>
  adminUserService.resetStaffPassword(req.params.id)
)

const updateUser = handleAdminUserRoute('updateUser', (req) =>
  adminUserService.updateUser(req.params.kind, req.params.id, req.body)
)

module.exports = { listUsers, getUserDetails, createUser, updateUser, deleteUser, resetStaffPassword }