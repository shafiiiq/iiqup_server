const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const uploadService = require('#core/upload/upload.service')
const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')
const { AUTH_MAIL_PATTERN } = require('./authN.constants')

const PROFILE_FEATURE = 'profile'
const MODELS = { staff: User, mechanic: Mechanic, operator: Operator }

const resolveProfileUserType = (tokenUserType) => {
  const normalizedUserType = String(tokenUserType || '').trim().toLowerCase()
  return MODELS[normalizedUserType] ? normalizedUserType : 'staff'
}

uploadService.registerCompletionHandler(PROFILE_FEATURE, async (session) => {
  const Model = MODELS[session.context]
  if (!Model) throw new AppError('Invalid user type', HTTP.BAD_REQUEST)

  await Model.findByIdAndUpdate(session.uploadedBy, {
    $set: {
      profilePic: {
        fileName: session.fileName,
        originalName: session.originalName,
        filePath: session.s3Key,
        mimeType: session.mimeType,
        uploadDate: new Date(),
        url: session.s3Key,
      },
    },
  })
})

const getProfile = async (userId, tokenUserType) => {
  const userType = resolveProfileUserType(tokenUserType)

  const profile = await MODELS[userType].findById(userId).select('_id name email role designation profilePic authMail createdAt')
  if (!profile) throw new AppError('User not found', HTTP.NOT_FOUND)

  return {
    status: HTTP.OK,
    success: true,
    data: {
      _id: profile._id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      designation: profile.designation || '',
      authMail: profile.authMail || '',
      createdAt: profile.createdAt,
      profilePic: { filePath: profile.profilePic?.filePath ?? '' },
    },
  }
}

const resolveAuthMailChange = async (userId, authMail) => {
  const normalizedAuthMail = typeof authMail === 'string' ? authMail.trim().toLowerCase() : ''
  if (!normalizedAuthMail) return ''

  if (!AUTH_MAIL_PATTERN.test(normalizedAuthMail)) {
    throw new AppError('Please enter a valid authentication email', HTTP.BAD_REQUEST)
  }
  const authMailOwner = await User.findOne({ authMail: normalizedAuthMail, _id: { $ne: userId } }).select('_id')
  if (authMailOwner) throw new AppError('This authentication email is already in use', HTTP.CONFLICT)

  return normalizedAuthMail
}

const updateProfile = async (userId, tokenUserType, { fullName, designation, authMail }) => {
  const userType = resolveProfileUserType(tokenUserType)

  if (!fullName?.trim() || !designation?.trim()) {
    throw new AppError('fullName and designation are required', HTTP.BAD_REQUEST)
  }

  const profileChanges = { name: fullName.trim(), designation: designation.trim(), updatedAt: new Date() }

  if (userType === 'staff') {
    const normalizedAuthMail = await resolveAuthMailChange(userId, authMail)
    if (normalizedAuthMail) profileChanges.authMail = normalizedAuthMail
  }

  const updated = await MODELS[userType].findByIdAndUpdate(
    userId,
    { $set: profileChanges },
    { new: true, select: '-password' }
  )
  if (!updated) throw new AppError('User not found', HTTP.NOT_FOUND)

  return {
    status: HTTP.OK,
    success: true,
    message: 'Profile updated successfully',
    data: { _id: updated._id, name: updated.name, designation: updated.designation, authMail: updated.authMail },
  }
}

module.exports = { PROFILE_FEATURE, getProfile, updateProfile }