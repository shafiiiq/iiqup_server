const HTTP = require('#shared/response/response.status')
const {
  createActivationRequest,
  pollActivationRequest,
  cancelActivationRequest,
  getRequestForApprover,
  listPendingRequestsForApprover,
  approveActivationRequest,
  denyActivationRequest,
} = require('./signature.request.service')
const { handleRoute, readDeviceToken, requireText } = require('./signature.route.handler')
const { ACTIVATION_REQUEST_KIND, DEVICE_PLATFORM } = require('./signature.constant')

const startActivationRequest = handleRoute('startActivationRequest', 'Failed to start activation', async (req) => {
  const isFamilyRequest = req.body.kind === ACTIVATION_REQUEST_KIND.FAMILY
  const isMobileRequest = req.body.platform === DEVICE_PLATFORM.MOBILE
  const data = await createActivationRequest({
    userId: req.user.id,
    kind: req.body.kind,
    platform: req.body.platform,
    activationCode: isFamilyRequest ? '' : requireText(req.body.activationCode, 'activationCode'),
    publicKey: isMobileRequest ? '' : requireText(req.body.publicKey, 'publicKey'),
    deviceLabel: req.body.deviceLabel,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    timezone: req.body.timezone,
  })
  return { status: HTTP.CREATED, message: 'Approval requested on your phone', data }
})

const pollRequest = handleRoute('pollRequest', 'Failed to check activation', async (req) => {
  const data = await pollActivationRequest({
    userId: req.user.id,
    requestId: req.params.requestId,
    pollSecret: requireText(req.body.pollSecret, 'pollSecret'),
  })
  return { status: HTTP.OK, data }
})

const cancelRequest = handleRoute('cancelRequest', 'Failed to cancel activation', async (req) => {
  const data = await cancelActivationRequest({
    userId: req.user.id,
    requestId: req.params.requestId,
    pollSecret: requireText(req.body.pollSecret, 'pollSecret'),
  })
  return { status: HTTP.OK, data }
})

const listMyRequests = handleRoute('listMyRequests', 'Failed to load activation requests', async (req) => {
  const data = await listPendingRequestsForApprover(req.user.id)
  return { status: HTTP.OK, data }
})

const getMyRequest = handleRoute('getMyRequest', 'Failed to load activation request', async (req) => {
  const data = await getRequestForApprover({ userId: req.user.id, requestId: req.params.requestId })
  return { status: HTTP.OK, data }
})

const approveMyRequest = handleRoute('approveMyRequest', 'Failed to approve activation', async (req) => {
  const data = await approveActivationRequest({
    userId: req.user.id,
    requestId: req.params.requestId,
    selectedNumber: req.body.selectedNumber,
    approverDeviceToken: readDeviceToken(req),
  })
  return { status: HTTP.OK, message: 'Activation approved', data }
})

const denyMyRequest = handleRoute('denyMyRequest', 'Failed to deny activation', async (req) => {
  const data = await denyActivationRequest({ userId: req.user.id, requestId: req.params.requestId })
  return { status: HTTP.OK, message: 'Activation denied', data }
})

module.exports = {
  startActivationRequest,
  pollRequest,
  cancelRequest,
  listMyRequests,
  getMyRequest,
  approveMyRequest,
  denyMyRequest,
}