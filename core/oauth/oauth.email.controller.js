const emailService = require('./oauth.email.service')
const { handleLinkRoute } = require('./oauth.route.handler')

const requestEmailOtp = handleLinkRoute('requestEmailOtp', (req) => emailService.requestEmailOtp(req.body.email))

const verifyEmailOtp = handleLinkRoute('verifyEmailOtp', (req) =>
  emailService.verifyEmailOtp({ email: req.body.email, otp: req.body.otp, deviceInfo: req.body.deviceInfo })
)

const completeEmailLogin = handleLinkRoute('completeEmailLogin', (req) =>
  emailService.completeEmailLogin({ linkToken: req.body.linkToken, deviceInfo: req.body.deviceInfo })
)

module.exports = { requestEmailOtp, verifyEmailOtp, completeEmailLogin }