const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { paginate } = require('#shared/pagination/pagination')
const { resolveOptionalSignedUrl } = require('#core/s3/s3.signed.url')
const Session = require('#core/session/session.model')
const { createAccount, hashPassword } = require('#core/account/account.factory')
const { listLinksForAccount, removeAllLinksForAccount } = require('#core/oauth/oauth.link.store')
const User = require('../staff/staff.model')
const { ADMIN_USER_KINDS, LIST_PROJECTION } = require('./admin.user.constant')
const { EDITABLE_USER_FIELDS } = require('./admin.user.editable')
const { sanitizeEditableValues } = require('./admin.user.sanitizer')

const resolveKindConfig = (kind) => {
  const config = ADMIN_USER_KINDS[kind]
  if (!config) throw new AppError('Invalid user kind', HTTP.BAD_REQUEST)
  return config
}

const listUsers = async (kind, pagination) => {
  const { model } = resolveKindConfig(kind)
  const result = await paginate(model, {}, pagination, { sort: { createdAt: -1 }, projection: LIST_PROJECTION })
  return { status: HTTP.OK, success: true, data: result.data, pagination: result.pagination }
}

const getUserDetails = async (kind, userId) => {
  const { model, hiddenFields } = resolveKindConfig(kind)

  const user = await model.findById(userId).select(hiddenFields).lean()
  if (!user) throw new AppError('User not found', HTTP.NOT_FOUND)

  const [loginActivity, linkedAccounts] = await Promise.all([
    Session.find({ userId }).select('-sessionToken').sort({ lastActivity: -1 }).lean(),
    listLinksForAccount(kind, userId),
  ])

  const profilePicPath = user.profilePic?.filePath
  if (profilePicPath) user.profilePic = { ...user.profilePic, signedUrl: await resolveOptionalSignedUrl(profilePicPath) }

  return { status: HTTP.OK, success: true, data: { user, loginActivity, linkedAccounts } }
}

const createUser = async (kind, body) => {
  resolveKindConfig(kind)
  const { name, email, password, qatarId, designation, role } = body

  if (!String(name || '').trim()) throw new AppError('Name is required', HTTP.BAD_REQUEST)

  let passwordHash
  if (kind === 'staff') {
    if (!String(email || '').trim() || !password) throw new AppError('Email and password are required', HTTP.BAD_REQUEST)
    passwordHash = await hashPassword(password)
  } else if (!String(qatarId || '').trim()) {
    throw new AppError('Qatar ID is required', HTTP.BAD_REQUEST)
  }

  const account = await createAccount({
    accountType: kind,
    name: name.trim(),
    email: String(email || '').trim().toLowerCase(),
    passwordHash,
    qatarId: String(qatarId || '').trim(),
    designation: String(designation || '').trim(),
    role: String(role || '').trim().toUpperCase() || undefined,
  })

  return { status: HTTP.CREATED, success: true, message: 'User created successfully', data: { _id: account._id } }
}

const deleteUser = async (kind, userId, requestingUserId) => {
  const { model } = resolveKindConfig(kind)
  if (String(userId) === String(requestingUserId)) throw new AppError('You cannot delete your own account', HTTP.BAD_REQUEST)

  const deleted = await model.findByIdAndDelete(userId)
  if (!deleted) throw new AppError('User not found', HTTP.NOT_FOUND)

  await Promise.all([Session.deleteMany({ userId }), removeAllLinksForAccount(kind, userId)])
  return { status: HTTP.OK, success: true, message: 'User deleted successfully' }
}

const resetStaffPassword = async (userId) => {
  const hashedPassword = await hashPassword(process.env.INIT_PSWD)
  const updated = await User.findByIdAndUpdate(userId, { password: hashedPassword, updatedAt: new Date() })
  if (!updated) throw new AppError('User not found', HTTP.NOT_FOUND)

  return { status: HTTP.OK, success: true, message: 'Password reset to the default password' }
}

const updateUser = async (kind, userId, body) => {
  resolveKindConfig(kind)
  const { model } = ADMIN_USER_KINDS[kind]
  const values = sanitizeEditableValues(EDITABLE_USER_FIELDS[kind], body)
  if (Object.keys(values).length === 0) throw new AppError('No changes provided', HTTP.BAD_REQUEST)

  let updated
  try {
    updated = await model.findByIdAndUpdate(
      userId,
      { $set: { ...values, updatedAt: new Date() } },
      { new: true, runValidators: true }
    )
  } catch (error) {
    if (error.code === 11000) throw new AppError('Another user already uses this value', HTTP.CONFLICT)
    throw error
  }

  if (!updated) throw new AppError('User not found', HTTP.NOT_FOUND)
  return { status: HTTP.OK, success: true, message: 'User updated successfully' }
}

module.exports = { listUsers, getUserDetails, createUser, updateUser, deleteUser, resetStaffPassword }