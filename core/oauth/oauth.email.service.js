const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { AUTH_MAIL_PATTERN } = require('#core/authN/authN.constants')
const OTP = require('#features/otp/otp.model')
const { sendOtpToAddress, checkOtpCode } = require('#features/otp/otp.service')
const { loginWithIdentity, loginByExistingLink } = require('./oauth.login.service')
const { verifySocialToken } = require('./oauth.link.token')
const { EMAIL_PROVIDER, SOCIAL_LINK_PURPOSE } = require('./oauth.constant')

const normalizeEmailAddress = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!AUTH_MAIL_PATTERN.test(normalizedEmail)) throw new AppError('Please enter a valid email address', HTTP.BAD_REQUEST)
  return normalizedEmail
}

const requestEmailOtp = async (email) => {
  const normalizedEmail = normalizeEmailAddress(email)
  const { otp } = await sendOtpToAddress(normalizedEmail)

  return {
    status: HTTP.OK,
    success: true,
    message: 'Verification code sent',
    data: { ...(process.env.NODE_ENV === 'development' && { otp }) },
  }
}

const verifyEmailOtp = async ({ email, otp, deviceInfo }) => {
  const normalizedEmail = normalizeEmailAddress(email)

  const failure = await checkOtpCode(normalizedEmail, String(otp || ''))
  if (failure) throw new AppError(failure.message, failure.status)
  await OTP.deleteOne({ email: normalizedEmail })

  return loginWithIdentity(
    EMAIL_PROVIDER,
    { subject: normalizedEmail, email: normalizedEmail, emailVerified: true, name: '' },
    deviceInfo
  )
}

const completeEmailLogin = async ({ linkToken, deviceInfo }) => {
  const claims = verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)
  if (claims.provider !== EMAIL_PROVIDER) throw new AppError('Invalid request', HTTP.BAD_REQUEST)

  const loginResult = await loginByExistingLink(EMAIL_PROVIDER, claims.subject, deviceInfo)
  if (!loginResult) throw new AppError('Your account has not been created yet', HTTP.FORBIDDEN)
  return loginResult
}

module.exports = { requestEmailOtp, verifyEmailOtp, completeEmailLogin }