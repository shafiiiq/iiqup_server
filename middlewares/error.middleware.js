const logger = require('#shared/logger/logger');
const { sendError } = require('#shared/response/response.sender');

const notFoundHandler = (req, res, next) => {
  return sendError(res, {
    status: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  return sendError(res, {
    status: err.status || 500,
    message: err.message || 'Internal server error',
    ...(err.errors ? { errors: err.errors } : {}),
  });
};

module.exports = { notFoundHandler, errorHandler };