const crypto = require('crypto')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const SignupRequest = require('./signup.model')
const { SIGNUP_STATUS, APPROVAL_CODE_MIN, APPROVAL_CODE_MAX } = require('./signup.constant')

const generatePendingApprovalCode = async () => {
  const pendingRequests = await SignupRequest.find({ status: SIGNUP_STATUS.PENDING }).select('approvalCode').lean()
  const usedCodes = new Set(pendingRequests.map((request) => request.approvalCode))

  const availableCodes = []
  for (let code = APPROVAL_CODE_MIN; code <= APPROVAL_CODE_MAX; code += 1) {
    if (!usedCodes.has(String(code))) availableCodes.push(String(code))
  }

  if (availableCodes.length === 0) {
    throw new AppError('Too many pending requests. Please try again later.', HTTP.TOO_MANY_REQUESTS)
  }
  return availableCodes[crypto.randomInt(availableCodes.length)]
}

module.exports = { generatePendingApprovalCode }