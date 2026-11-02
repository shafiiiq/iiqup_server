const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendError } = require('#shared/response/response.sender')
const Session = require('#core/session/session.model')
const { verifyDeviceToken, isPrimaryDevice } = require('./signature.device.service')
const {
  DEVICE_TOKEN_HEADER,
  MOBILE_PLATFORMS,
  DEVICE_PLATFORM,
  SIGNATURE_ERROR_CODE,
} = require('./signature.constant')

const SESSION_TOKEN_HEADER = 'x-session-token'

const requireMobileSession = async (req, res, next) => {
  try {
    const sessionToken = req.get(SESSION_TOKEN_HEADER)
    const session = sessionToken
      ? await Session.findOne({ sessionToken, userId: req.user.id, isActive: true }).select('deviceInfo.platform').lean()
      : null
    const platform = String(session?.deviceInfo?.platform || '').toLowerCase()

    if (!MOBILE_PLATFORMS.includes(platform)) {
      return sendError(res, {
        status: HTTP.FORBIDDEN,
        message: 'This action is only available from the mobile app',
        errors: { code: SIGNATURE_ERROR_CODE.MOBILE_SESSION_REQUIRED },
      })
    }
    return next()
  } catch (error) {
    logger.error('[signature.mobile.guard] requireMobileSession:', error)
    return sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to verify mobile session' })
  }
}

const requireMobileSigningDevice = async (req, res, next) => {
  try {
    const device = await verifyDeviceToken({ userId: req.user.id, deviceToken: req.get(DEVICE_TOKEN_HEADER) })
    if (!device || device.platform !== DEVICE_PLATFORM.MOBILE || !isPrimaryDevice(device)) {
      return sendError(res, {
        status: HTTP.FORBIDDEN,
        message: 'Activate this phone for signing first',
        errors: { code: SIGNATURE_ERROR_CODE.DEVICE_NOT_ACTIVATED },
      })
    }
    req.signatureDevice = device
    return next()
  } catch (error) {
    logger.error('[signature.mobile.guard] requireMobileSigningDevice:', error)
    return sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to verify signing device' })
  }
}

module.exports = { requireMobileSession, requireMobileSigningDevice }