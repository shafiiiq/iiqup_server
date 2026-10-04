const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const uploadService = require('#core/upload/upload.service')
const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')

const PROFILE_FEATURE = 'profile'
const MODELS = { staff: User, mechanic: Mechanic, operator: Operator }

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

const updateProfile = async (userId, userType, { fullName, designation }) => {
  if (!MODELS[userType]) throw new AppError('Invalid user type', HTTP.BAD_REQUEST)
  if (userType !== 'staff') return { status: HTTP.OK, success: true, message: 'Nothing to update' }

  if (!fullName?.trim() || !designation?.trim()) {
    throw new AppError('fullName and designation are required', HTTP.BAD_REQUEST)
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { name: fullName.trim(), designation: designation.trim(), updatedAt: new Date() } },
    { new: true, select: '-password' }
  )
  if (!updated) throw new AppError('User not found', HTTP.NOT_FOUND)

  return {
    status: HTTP.OK,
    success: true,
    message: 'Profile updated successfully',
    data: { _id: updated._id, name: updated.name, designation: updated.designation },
  }
}

module.exports = { PROFILE_FEATURE, updateProfile }