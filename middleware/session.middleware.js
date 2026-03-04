const Session = require('../models/sessions.model');

const checkSessionValidity = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let authMiddleware handle this
    }

    const token = authHeader.split(' ')[1];
    
    // Check if session exists and is active
    const session = await Session.findOne({
      sessionToken: token,
      isActive: true
    });

    // If session doesn't exist or is inactive, reject the request
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalidated',
        sessionInvalid: true
      });
    }

    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    next();
  } catch (error) {
    console.error('Session check error:', error);
    next();
  }
};

module.exports = { checkSessionValidity };