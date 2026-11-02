const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { createSignatureForUser, reissueActivationCode } = require('./signature.asset.service')
const { getMySignatureStatus } = require('./signature.status.service')
const { getDocumentSignatures, getEventImageDataUrl } = require('./signature.view.service')
const { signDocument } = require('./signature.sign.service')
const { issueChallenge } = require('./signature.challenge.service')
const { handleRoute, readDeviceToken, requireText } = require('./signature.route.handler')

const createUserSignature = handleRoute('createUserSignature', 'Failed to store signature', async (req) => {
  if (!req.file) throw new AppError('signature image is required', HTTP.BAD_REQUEST)
  const data = await createSignatureForUser({
    targetUserId: req.params.userId,
    imageBuffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    actorUserId: req.user.id,
  })
  return { status: HTTP.CREATED, message: 'Signature stored. Hand the activation code to the owner once.', data }
})

const reissueUserActivationCode = handleRoute('reissueUserActivationCode', 'Failed to issue activation code', async (req) => {
  const data = await reissueActivationCode({ targetUserId: req.params.userId, actorUserId: req.user.id })
  return { status: HTTP.OK, message: 'Activation code issued', data }
})

const getMyStatus = handleRoute('getMyStatus', 'Failed to load signature status', async (req) => {
  const data = await getMySignatureStatus({ userId: req.user.id, deviceToken: readDeviceToken(req) })
  return { status: HTTP.OK, data }
})

const getDocumentSignatureView = handleRoute('getDocumentSignatureView', 'Failed to load signatures', async (req) => {
  const data = await getDocumentSignatures({
    sourceKey: req.params.sourceKey,
    documentId: req.params.documentId,
    requester: req.user,
  })
  return { status: HTTP.OK, data }
})

const getEventImage = handleRoute('getEventImage', 'Failed to load signature image', async (req) => {
  req.res.set('Cache-Control', 'no-store')
  const data = await getEventImageDataUrl({
    eventId: req.params.eventId,
    requester: req.user,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  return { status: HTTP.OK, data }
})

const createChallenge = handleRoute('createChallenge', 'Failed to create signing challenge', async (req) => {
  const data = await issueChallenge({ userId: req.user.id, deviceToken: readDeviceToken(req) })
  return { status: HTTP.OK, data }
})

const sign = handleRoute('sign', 'Signing failed', async (req) =>
  signDocument({
    requester: req.user,
    deviceToken: readDeviceToken(req),
    challengeId: req.body.challengeId,
    proof: req.body.proof,
    sourceKey: requireText(req.body.sourceKey, 'sourceKey'),
    documentId: requireText(req.body.documentId, 'documentId'),
    slotId: requireText(req.body.slotId, 'slotId'),
    override: req.body.override === true,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
)

module.exports = {
  createUserSignature,
  reissueUserActivationCode,
  getMyStatus,
  getDocumentSignatureView,
  getEventImage,
  createChallenge,
  sign,
}