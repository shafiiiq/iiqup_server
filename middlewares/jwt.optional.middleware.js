const { verifyAuthToken } = require('#middlewares/jwt.middleware');

const BEARER_PREFIX = 'Bearer ';

const attachUserIfPresent = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) return next();

  try {
    const decodedToken = verifyAuthToken(authorizationHeader.slice(BEARER_PREFIX.length));
    req.user = decodedToken;
    req.userId = decodedToken.id;
  } catch (error) {
    req.user = undefined;
  }
  return next();
};

module.exports = { attachUserIfPresent };