const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');

const handleNotificationRoute = (logTag, handler) => async (req, res) => {
  try {
    const { status, message, data, pagination } = await handler(req);
    sendSuccess(res, { status, message, data, pagination });
  } catch (error) {
    logger.error(`[notification.controller] ${logTag}`, error);
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

module.exports = { handleNotificationRoute };