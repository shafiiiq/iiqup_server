const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { createSession, buildDeviceData } = require('#core/session/session.service')
const { generateAuthTokens } = require('#middlewares/jwt.middleware')

const pickUser = (account) => ({
  _id: account._id,
  name: account.name,
  email: account.email,
  role: account.role,
  userType: account.userType,
  uniqueCode: account.uniqueCode,
  qatarId: account.qatarId,
  equipmentNumber: account.equipmentNumber,
  designation: account.designation,
  profilePic: account.profilePic,
})

const buildLoginResult = async (source, account, deviceInfo) => {
  if (source.type !== 'operator' && !account.isActive) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', HTTP.FORBIDDEN)
  }

  const sessionToken = await createSession(
    account._id,
    source.sessionModel,
    buildDeviceData(deviceInfo),
    deviceInfo?.location || null
  )

  const tokens = generateAuthTokens({
    _id: account._id,
    email: account.email,
    role: account.role,
    uniqueCode: account.uniqueCode,
    userType: account.userType,
    name: account.name,
  })

  return {
    status: HTTP.OK,
    success: true,
    authorized: true,
    message: 'Authentication successful',
    data: {
      user: pickUser(account),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionToken,
    },
  }
}

module.exports = { buildLoginResult }