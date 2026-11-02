const HTTP = require('#shared/response/response.status')
const {
  listDelegationRequests,
  listGivenDelegations,
  listReceivedDelegations,
  requestDelegationForSlot,
  approveDelegation,
  denyDelegation,
  revokeDelegation,
} = require('./signature.delegation.service')
const { handleRoute, requireText } = require('./signature.route.handler')

const createDelegationRequest = handleRoute('createDelegationRequest', 'Failed to send request', async (req) => {
  const data = await requestDelegationForSlot({
    requester: req.user,
    sourceKey: requireText(req.body.sourceKey, 'sourceKey'),
    documentId: requireText(req.body.documentId, 'documentId'),
    slotId: requireText(req.body.slotId, 'slotId'),
  })
  return { status: HTTP.CREATED, message: 'Permission requested', data }
})

const getDelegationRequests = handleRoute('getDelegationRequests', 'Failed to load requests', async (req) => ({
  status: HTTP.OK,
  data: await listDelegationRequests(req.user.id),
}))

const getGivenDelegations = handleRoute('getGivenDelegations', 'Failed to load permissions', async (req) => ({
  status: HTTP.OK,
  data: await listGivenDelegations(req.user.id),
}))

const getReceivedDelegations = handleRoute('getReceivedDelegations', 'Failed to load permissions', async (req) => ({
  status: HTTP.OK,
  data: await listReceivedDelegations(req.user.id),
}))

const approveDelegationRequest = handleRoute('approveDelegationRequest', 'Failed to approve request', async (req) => ({
  status: HTTP.OK,
  message: 'Permission granted',
  data: await approveDelegation({ ownerId: req.user.id, delegationId: req.params.delegationId }),
}))

const denyDelegationRequest = handleRoute('denyDelegationRequest', 'Failed to deny request', async (req) => ({
  status: HTTP.OK,
  message: 'Request denied',
  data: await denyDelegation({ ownerId: req.user.id, delegationId: req.params.delegationId }),
}))

const revokeGivenDelegation = handleRoute('revokeGivenDelegation', 'Failed to revoke permission', async (req) => ({
  status: HTTP.OK,
  message: 'Permission revoked',
  data: await revokeDelegation({ ownerId: req.user.id, delegationId: req.params.delegationId }),
}))

module.exports = {
  createDelegationRequest,
  getDelegationRequests,
  getGivenDelegations,
  getReceivedDelegations,
  approveDelegationRequest,
  denyDelegationRequest,
  revokeGivenDelegation,
}