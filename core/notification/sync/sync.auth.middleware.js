const HTTP = require('#shared/response/response.status');
const { sendError } = require('#shared/response/response.sender');
const { verifySyncToken } = require('./sync.token');

const BEARER_PREFIX = 'Bearer ';

const syncAuthMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : '';
  const payload = verifySyncToken(token);
  if (!payload) return sendError(res, { status: HTTP.FORBIDDEN, message: 'Invalid sync token' });
  req.syncUniqueCode = payload.uniqueCode;
  return next();
};

module.exports = { syncAuthMiddleware };