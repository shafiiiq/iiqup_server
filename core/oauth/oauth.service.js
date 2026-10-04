const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')
const { createSession } = require('#core/session/session.service')
const { generateAuthTokens } = require('#middlewares/jwt.middleware')
const { verifyProviderToken } = require('./oauth.providers')

const ACCOUNT_SOURCES = [
  { type: 'staff', model: User, sessionModel: 'User' },
  { type: 'mechanic', model: Mechanic, sessionModel: 'Mechanic' },
  { type: 'operator', model: Operator, sessionModel: 'Operator' },
]

const findAccountByEmail = async (email) => {
  for (const source of ACCOUNT_SOURCES) {
    const account = await source.model.findOne({ email })
    if (account) return { ...source, account }
  }
  return null
}

const buildDeviceData = (deviceInfo) => ({
  deviceName: deviceInfo?.deviceName || 'Unknown Device',
  deviceModel: deviceInfo?.deviceModel || 'Unknown Model',
  deviceId: deviceInfo?.deviceId || 'Unknown ID',
  brand: deviceInfo?.brand || 'Unknown',
  osName: deviceInfo?.osName || 'Unknown OS',
  osVersion: deviceInfo?.osVersion || 'Unknown',
  platform: deviceInfo?.platform || 'Unknown',
  loginTime: deviceInfo?.loginTime || new Date().toISOString(),
  ipAddress: deviceInfo?.ipAddress || 'Unknown IP',
  locationAddress: deviceInfo?.locationAddress || 'Unknown',
})

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

const loginWithProvider = async (provider, token, deviceInfo) => {
  const identity = await verifyProviderToken(provider, token)
  if (!identity.email || !identity.emailVerified) {
    throw new AppError('The email on this account is not verified', HTTP.FORBIDDEN)
  }

  const match = await findAccountByEmail(identity.email.toLowerCase())
  if (!match) throw new AppError('No account is linked to this email', HTTP.NOT_FOUND)

  const { account, type, sessionModel } = match
  if (type !== 'operator' && !account.isActive) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', HTTP.FORBIDDEN)
  }

  const sessionToken = await createSession(account._id, sessionModel, buildDeviceData(deviceInfo), deviceInfo?.location || null)

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

module.exports = { loginWithProvider }