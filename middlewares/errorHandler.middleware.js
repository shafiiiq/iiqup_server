const logger = require('../shared/logger/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    message,
    ...(err.errors ? { errors: err.errors } : {}),
  });
};

module.exports = errorHandler;
