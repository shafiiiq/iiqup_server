const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');

const handleScheduleRoute = (logTag, handler) => async (req, res) => {
  try {
    const { status, message, data } = await handler(req);
    sendSuccess(res, { status, message, data });
  } catch (error) {
    logger.error(`[schedule.controller] ${logTag}`, error);
    sendError(res, { status: error.status || HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

module.exports = { handleScheduleRoute };