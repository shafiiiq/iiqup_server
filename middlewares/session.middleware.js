const logger = require('#shared/logger/logger');
const Session = require('../core/session/session.model');

const checkSessionValidity = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    const session = await Session.findOne({ sessionToken: token, isActive: true });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalidated',
        sessionInvalid: true,
      });
    }

    session.lastActivity = new Date();
    await session.save();

    next();
  } catch (error) {
    logger.error('[session.middleware] checkSessionValidity', error.message);
    next();
  }
};

module.exports = { checkSessionValidity };