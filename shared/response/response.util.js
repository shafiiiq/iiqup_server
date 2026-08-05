/**
 * Standardized success response.
 */
const sendSuccess = (res, payload = {}) => {
  const { status = 200, ...rest } = payload;
  const body = { success: true, ...rest };
  return res.status(status).json(body);
};

/**
 * Standardized error response.
 */
const sendError = (res, payload = {}) => {
  const { status = 500, ...rest } = payload;
  const body = { success: false, ...rest };
  return res.status(status).json(body);
};

module.exports = { sendSuccess, sendError };