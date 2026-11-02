const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const { DEVICE_TOKEN_HEADER } = require('./signature.constant')

const handleRoute = (logTag, fallbackMessage, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req))
  } catch (error) {
    logger.error(`[signature.controller] ${logTag}:`, error)
    const isKnownError = error instanceof AppError
    sendError(res, {
      status: isKnownError ? error.status : HTTP.INTERNAL_SERVER_ERROR,
      message: isKnownError ? error.message : fallbackMessage,
      ...(isKnownError && error.errors ? { errors: error.errors } : {}),
    })
  }
}

const readDeviceToken = (req) => req.get(DEVICE_TOKEN_HEADER)

const requireText = (value, fieldName) => {
  if (!value || typeof value !== 'string') throw new AppError(`${fieldName} is required`, HTTP.BAD_REQUEST)
  return value
}

module.exports = { handleRoute, readDeviceToken, requireText }