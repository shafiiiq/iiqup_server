const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { refreshAuthTokens } = require('#middlewares/jwt.middleware');

const authRefresh = async (refreshToken) => {
  try {
    if (!refreshToken) {
      return { status: HTTP.UNAUTHORIZED, success: false, message: 'Refresh token is required' };
    }

    let token = refreshToken;
    if (typeof token === 'string' && token.startsWith('"') && token.endsWith('"')) {
      try {
        token = JSON.parse(token);
      } catch (_) { }
    }
    token = token.trim();

    const tokens = refreshAuthTokens(token);

    return {
      status: HTTP.OK,
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    logger.error('[authN.service] authRefresh', error.message);

    let message = 'Invalid refresh token';
    if (error.name === 'TokenExpiredError') message = 'Refresh token expired';
    if (error.name === 'JsonWebTokenError') message = 'Malformed refresh token';

    return { status: HTTP.FORBIDDEN, success: false, message };
  }
};

module.exports = {
  authRefresh,
};