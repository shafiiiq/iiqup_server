const jwt = require('jsonwebtoken');

// JWT Secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,        // Using 'id' here
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      uniqueCode: user.uniqueCode,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Verify a JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.log('Token verification error:', error.message);
    throw error; // Re-throw so middleware can handle it
  }
};

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
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
    
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    console.log('Auth middleware error:', error.message);
    return res.status(403).json({ message: 'Invalid token.', status: 401 });
  }
};

/**
 * Middleware to check if user has required role(s)
 * @param {Array|String} roles - Required role(s)
 * @returns {Function} Express middleware
 */
const roleCheck = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

/**
 * Refresh JWT token
 * @param {String} refreshToken - Refresh token
 * @returns {Object} New access token and refresh token
 */
const refreshToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    // Create new tokens
    const user = {
      _id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      uniqueCode: decoded.uniqueCode
    };

    const newAccessToken = generateToken(user);

    return {
      accessToken: newAccessToken
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  roleCheck,
  refreshToken,
  generateTokens
};