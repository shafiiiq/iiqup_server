const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { sendSuccess, sendError } = require('#shared/response/response.sender');

const handleChatRoute = (logTag, fallbackMessage, handler) => async (req, res) => {
  try {
    const { status = HTTP.OK, message, data, pagination } = await handler(req);
    sendSuccess(res, { status, message, data, pagination });
  } catch (error) {
    logger.error(`[chat] ${logTag}:`, error);
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message || fallbackMessage });
  }
};

const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, HTTP.BAD_REQUEST);
  return String(value);
};

module.exports = { handleChatRoute, assertObjectId };