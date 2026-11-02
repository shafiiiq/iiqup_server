const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const tokenService = require('./token.service');

const SUPPORTED_PLATFORMS = ['ios', 'android'];

const respondWithResult = (res, result) => {
  if (!result.success) return sendError(res, { status: HTTP.BAD_REQUEST, message: result.message });
  return sendSuccess(res, { status: HTTP.OK, message: result.message, data: result.data });
};

const handleTokenRoute = (logTag, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    logger.error(`[token.controller] ${logTag}`, error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const getUserPushTokens = handleTokenRoute('getUserPushTokens', async (req, res) => {
  respondWithResult(res, await tokenService.getUserPushTokens(req.user.uniqueCode));
});

const insertPushToken = handleTokenRoute('insertPushToken', async (req, res) => {
  const { pushToken, platform } = req.body;
  if (!pushToken) return sendError(res, { status: HTTP.BAD_REQUEST, message: 'pushToken is required' });
  if (platform && !SUPPORTED_PLATFORMS.includes(platform)) {
    return sendError(res, { status: HTTP.BAD_REQUEST, message: 'platform must be ios or android' });
  }
  respondWithResult(res, await tokenService.insertPushToken(req.user.uniqueCode, pushToken, platform));
});

const insertVoipToken = handleTokenRoute('insertVoipToken', async (req, res) => {
  const { voipToken } = req.body;
  if (!voipToken) return sendError(res, { status: HTTP.BAD_REQUEST, message: 'voipToken is required' });
  respondWithResult(res, await tokenService.insertVoipToken(req.user.uniqueCode, voipToken));
});

const removePushToken = handleTokenRoute('removePushToken', async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return sendError(res, { status: HTTP.BAD_REQUEST, message: 'pushToken is required' });
  respondWithResult(res, await tokenService.removePushToken(req.user.uniqueCode, pushToken));
});

const insertWebPushSubscription = handleTokenRoute('insertWebPushSubscription', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return sendError(res, { status: HTTP.BAD_REQUEST, message: 'subscription is required' });
  respondWithResult(res, await tokenService.insertWebPushSubscription(req.user.uniqueCode, subscription));
});

const removeWebPushSubscription = handleTokenRoute('removeWebPushSubscription', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return sendError(res, { status: HTTP.BAD_REQUEST, message: 'endpoint is required' });
  respondWithResult(res, await tokenService.removeWebPushSubscription(req.user.uniqueCode, endpoint));
});

module.exports = {
  getUserPushTokens,
  insertPushToken,
  insertVoipToken,
  removePushToken,
  insertWebPushSubscription,
  removeWebPushSubscription,
};