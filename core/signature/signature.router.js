const express = require('express')
const multer = require('multer')
const controller = require('./signature.controller')
const requestController = require('./signature.request.controller')
const ownerController = require('./signature.owner.controller')
const delegationController = require('./signature.delegation.controller')
const { requireRoles } = require('#middlewares/role.middleware')
const { requireMobileSession, requireMobileSigningDevice } = require('./signature.mobile.guard')
const { SIGNATURE_ADMIN_ROLES, MAX_SIGNATURE_IMAGE_BYTES } = require('./signature.constant')

const router = express.Router()
const signatureImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIGNATURE_IMAGE_BYTES, files: 1 },
})
const signatureAdminOnly = requireRoles(...SIGNATURE_ADMIN_ROLES)

router.post('/admin/users/:userId', signatureAdminOnly, signatureImageUpload.single('signature'), controller.createUserSignature)
router.post('/admin/users/:userId/activation-code', signatureAdminOnly, controller.reissueUserActivationCode)

router.post('/activation-requests', requestController.startActivationRequest)
router.post('/activation-requests/:requestId/poll', requestController.pollRequest)
router.post('/activation-requests/:requestId/cancel', requestController.cancelRequest)

router.post('/activate/mobile', requireMobileSession, ownerController.activatePhone)

router.get('/me/status', controller.getMyStatus)
router.get('/me/overview', requireMobileSession, ownerController.getOverview)
router.get('/me/devices', requireMobileSession, ownerController.listMyDevices)
router.delete('/me/devices/:deviceId', requireMobileSession, ownerController.blockMyDevice)
router.get('/me/access-log', requireMobileSession, ownerController.getMyAccessLog)
router.get('/me/activation-requests', requireMobileSession, requestController.listMyRequests)
router.get('/me/activation-requests/:requestId', requireMobileSession, requestController.getMyRequest)
router.post('/me/activation-requests/:requestId/approve', requireMobileSession, requestController.approveMyRequest)
router.post('/me/activation-requests/:requestId/deny', requireMobileSession, requestController.denyMyRequest)

router.post('/delegations/requests', delegationController.createDelegationRequest)
router.get('/me/delegations/given', delegationController.getGivenDelegations)
router.get('/me/delegations/received', delegationController.getReceivedDelegations)
router.post('/me/delegations/:delegationId/revoke', delegationController.revokeGivenDelegation)
router.get('/me/delegations/requests', requireMobileSession, delegationController.getDelegationRequests)
router.post('/me/delegations/:delegationId/approve', requireMobileSession, delegationController.approveDelegationRequest)
router.post('/me/delegations/:delegationId/deny', requireMobileSession, delegationController.denyDelegationRequest)
router.post('/me/activation-code', requireMobileSession, requireMobileSigningDevice, ownerController.rotateActivationCode)
router.put(
  '/me/signature',
  requireMobileSession,
  requireMobileSigningDevice,
  signatureImageUpload.single('signature'),
  ownerController.replaceSignature
)

router.get('/sources/:sourceKey/documents/:documentId', controller.getDocumentSignatureView)
router.get('/events/:eventId/image', controller.getEventImage)
router.post('/challenge', controller.createChallenge)
router.post('/sign', controller.sign)

module.exports = router