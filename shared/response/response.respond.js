const { sendSuccess, sendError } = require('./response.sender');

const isFailure = (result) => result.ok === false || result.success === false;

const respond = (res, result) => (isFailure(result) ? sendError(res, result) : sendSuccess(res, result));

module.exports = { respond };
