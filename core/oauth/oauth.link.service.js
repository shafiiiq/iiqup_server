const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const User = require('#features/user/staff/staff.model')
const OTP = require('#features/otp/otp.model')
const { generateAndSendOTP, checkOtpCode } = require('#features/otp/otp.service')
const { resolveOptionalSignedUrl } = require('#core/s3/s3.signed.url')
const { getAccountSource, findAccountById } = require('./oauth.account')
const { createLink } = require('./oauth.link.store')
const { assertIdentityAvailable } = require('./oauth.link.guard')
const { signSocialToken, verifySocialToken } = require('./oauth.link.token')
const { buildLoginResult } = require('./oauth.login.result')
const { SOCIAL_LINK_PURPOSE, SOCIAL_CONFIRM_PURPOSE, CONFIRM_TOKEN_EXPIRY } = require('./oauth.constant')

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const maskEmail = (email) => {
  const [localPart, domain] = email.split('@')
  return `${localPart.slice(0, 2)}***@${domain}`
}

const findLinkableStaff = async (email) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) throw new AppError('Email is required', HTTP.BAD_REQUEST)

  const staff = await User.findOne({ email: normalizedEmail })
  if (!staff) throw new AppError('No staff account found with this email', HTTP.NOT_FOUND)
  if (!staff.isActive) throw new AppError('This account has been deactivated', HTTP.BAD_REQUEST)
  if (!staff.authMail) {
    throw new AppError('This account has no authentication email. Sign in with your password first to set one.', HTTP.BAD_REQUEST)
  }
  return staff
}

const requestStaffLinkOtp = async ({ linkToken, email }) => {
  verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)
  const staff = await findLinkableStaff(email)

  const otpResult = await generateAndSendOTP(staff.authMail)
  if (!otpResult.success) throw new AppError(otpResult.message, otpResult.status || HTTP.BAD_REQUEST)

  return {
    status: HTTP.OK,
    success: true,
    message: 'Verification code sent',
    data: {
      maskedAuthMail: maskEmail(staff.authMail),
      ...(otpResult.data?.otp && { otp: otpResult.data.otp }),
    },
  }
}

const verifyStaffLinkOtp = async ({ linkToken, email, otp }) => {
  const claims = verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)
  const staff = await findLinkableStaff(email)

  const failure = await checkOtpCode(staff.authMail, String(otp || ''))
  if (failure) throw new AppError(failure.message, failure.status)
  await OTP.deleteOne({ email: staff.authMail })

  await assertIdentityAvailable(claims.provider, claims.subject, staff._id)

  const confirmToken = signSocialToken(
    SOCIAL_CONFIRM_PURPOSE,
    {
      provider: claims.provider,
      subject: claims.subject,
      email: claims.email,
      accountType: 'staff',
      accountId: String(staff._id),
    },
    CONFIRM_TOKEN_EXPIRY
  )

  return {
    status: HTTP.OK,
    success: true,
    message: 'Code verified',
    data: {
      confirmToken,
      profile: {
        fullName: staff.name,
        designation: staff.designation || '',
        profilePic: {
          filePath: staff.profilePic?.filePath ?? '',
          signedUrl: await resolveOptionalSignedUrl(staff.profilePic?.filePath),
        },
      },
    },
  }
}

const confirmSocialLink = async ({ confirmToken, deviceInfo }) => {
  const claims = verifySocialToken(SOCIAL_CONFIRM_PURPOSE, confirmToken)

  const match = await findAccountById(claims.accountType, claims.accountId)
  if (!match) throw new AppError('Account not found', HTTP.NOT_FOUND)

  await assertIdentityAvailable(claims.provider, claims.subject, match.account._id)
  await createLink({
    provider: claims.provider,
    subject: claims.subject,
    accountType: match.source.type,
    accountId: match.account._id,
    email: claims.email,
  })

  return buildLoginResult(match.source, match.account, deviceInfo)
}

const linkWithQatarId = async ({ linkToken, type, qatarId, deviceInfo }) => {
  const claims = verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)

  const source = getAccountSource(type)
  if (!source || source.type === 'staff') throw new AppError('Invalid account type', HTTP.BAD_REQUEST)

  const account = await source.model.findOne({ qatarId: String(qatarId || '').trim() })
  if (!account) {
    throw new AppError('Your account does not exist in our system. Please contact the admin.', HTTP.NOT_FOUND)
  }

  await assertIdentityAvailable(claims.provider, claims.subject, account._id)
  await createLink({
    provider: claims.provider,
    subject: claims.subject,
    accountType: source.type,
    accountId: account._id,
    email: claims.email,
  })

  return buildLoginResult(source, account, deviceInfo)
}

module.exports = { requestStaffLinkOtp, verifyStaffLinkOtp, confirmSocialLink, linkWithQatarId }