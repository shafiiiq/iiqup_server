const jwt = require('jsonwebtoken');
const logger = require('#shared/logger/logger');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

const generateAuthTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
      type: 'access',
    },
    getJwtSecret(),
    { expiresIn: '365d' }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
      type: 'refresh',
    },
    getJwtSecret(),
    { expiresIn: '365d' }
  );

  return { accessToken, refreshToken };
};

const generateRenderToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      userType: user.userType,
      name: user.name,
    },
    getJwtSecret(),
    { expiresIn: '2m' }
  );
};


const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = verifyAuthToken(token);

    req.user = decoded;
    req.userId = decoded.id;
    next();
  } catch (error) {
    logger.error('[jwt.middleware] authMiddleware', error);
    return res.status(403).json({ message: 'Invalid token.', status: 401 });
  }
};

const checkUserAuthorization = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // const isUserAuthorized = //what is we actualy need here is, resolve the who user type by userType, find who is user from corresponding user module with the help of service functions, check their permissions to access contents.

    // if (!isUserAuthorized) {
    //   return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    // }

    next();
  } catch (error) {
    logger.error('[jwt.middleware] checkUserAuthorization', error);
    return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
  }

};

const refreshAuthTokens = (currentRefreshToken) => {
  try {
    const decoded = verifyAuthToken(currentRefreshToken)

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = {
      _id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      uniqueCode: decoded.uniqueCode,
      userType: decoded.userType,
      name: decoded.name,
    };

    return generateAuthTokens(user);
  } catch (error) {
    logger.error('[jwt.middleware] refreshAuthTokens', error.message);
    throw new Error('Invalid refresh token', { cause: error });
  }
};

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    logger.error('[jwt.middleware] verifyAuthToken', error);
    throw error;
  }
};

module.exports = {
  verifyAuthToken,
  authMiddleware,
  checkUserAuthorization,
  refreshAuthTokens,
  generateAuthTokens,
  generateRenderToken
};