const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { activateMobileDevice } = require('./signature.activation.service')
const { createSignatureForUser, reissueActivationCode } = require('./signature.asset.service')
const { listDevices, revokeDevice } = require('./signature.device.service')
const { getOwnOverview } = require('./signature.overview.service')
const { getAccessLog } = require('./signature.accesslog.service')
const { handleRoute, requireText } = require('./signature.route.handler')

const activatePhone = handleRoute('activatePhone', 'Failed to activate this phone', async (req) => {
  const data = await activateMobileDevice({
    userId: req.user.id,
    activationCode: requireText(req.body.activationCode, 'activationCode'),
    deviceLabel: req.body.deviceLabel,
    userAgent: req.get('user-agent'),
    operatingSystem: req.body.operatingSystem,
    ipAddress: req.ip,
  })
  return { status: HTTP.OK, message: 'This phone is activated for signing', data }
})

const getOverview = handleRoute('getOverview', 'Failed to load signature', async (req) => {
  req.res.set('Cache-Control', 'no-store')
  return { status: HTTP.OK, data: await getOwnOverview(req.user.id) }
})

const rotateActivationCode = handleRoute('rotateActivationCode', 'Failed to rotate activation code', async (req) => {
  const data = await reissueActivationCode({ targetUserId: req.user.id, actorUserId: req.user.id })
  return { status: HTTP.OK, message: 'New activation code issued', data }
})

const replaceSignature = handleRoute('replaceSignature', 'Failed to replace signature', async (req) => {
  if (!req.file) throw new AppError('signature image is required', HTTP.BAD_REQUEST)
  const data = await createSignatureForUser({
    targetUserId: req.user.id,
    imageBuffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    actorUserId: req.user.id,
    preservedDeviceId: req.signatureDevice._id,
  })
  return { status: HTTP.OK, message: 'Signature replaced. Other devices were signed out', data }
})

const listMyDevices = handleRoute('listMyDevices', 'Failed to load devices', async (req) => ({
  status: HTTP.OK,
  data: await listDevices(req.user.id),
}))

const blockMyDevice = handleRoute('blockMyDevice', 'Failed to block device', async (req) => {
  const data = await revokeDevice({ userId: req.user.id, deviceId: req.params.deviceId })
  return { status: HTTP.OK, message: 'Device blocked', data }
})

const getMyAccessLog = handleRoute('getMyAccessLog', 'Failed to load activity', async (req) => ({
  status: HTTP.OK,
  data: await getAccessLog({ userId: req.user.id, before: req.query.before }),
}))

module.exports = {
  activatePhone,
  getOverview,
  rotateActivationCode,
  replaceSignature,
  listMyDevices,
  blockMyDevice,
  getMyAccessLog,
}