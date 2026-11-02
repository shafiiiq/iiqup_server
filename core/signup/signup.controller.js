const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const signupService = require('./signup.service')

const handleSignupRoute = (logTag, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req))
  } catch (error) {
    logger.error(`[signup.controller] ${logTag}`, error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const createSignupRequest = handleSignupRoute('createSignupRequest', (req) =>
  signupService.createSignupRequest(req.body)
)

const getSignupRequestStatus = handleSignupRoute('getSignupRequestStatus', (req) =>
  signupService.getSignupRequestStatus(req.params.requestId)
)

const listPendingSignupRequests = handleSignupRoute('listPendingSignupRequests', () =>
  signupService.listPendingSignupRequests()
)

const approveSignupRequest = handleSignupRoute('approveSignupRequest', (req) =>
  signupService.approveSignupRequest(req.params.requestId, req.user.id)
)

const rejectSignupRequest = handleSignupRoute('rejectSignupRequest', (req) =>
  signupService.rejectSignupRequest(req.params.requestId, req.user.id)
)

module.exports = {
  createSignupRequest,
  getSignupRequestStatus,
  listPendingSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
}