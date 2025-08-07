/**
 * Overtime cleanup middleware
 * Automatically cleans up old overtime data during request processing
 */
const overtimeCleanupMiddleware = (req, res, next) => {
  // Only run cleanup on a small percentage of requests to avoid performance impact
  // Here we run it with a 1% probability (adjust as needed)
  if (Math.random() < 0.01) {
    console.log('Running overtime cleanup middleware');
    const mechanicService = require('../services/mechanic-service');
    
    // Run cleanup asynchronously without blocking the request
    mechanicService.cleanupAllOldOvertimeData()
      .then(result => console.log('Middleware cleanup completed:', result))
      .catch(err => console.error('Middleware cleanup error:', err));
  }
  
  // Always proceed with the original request
  next();
};

module.exports = {
  overtimeCleanupMiddleware
};