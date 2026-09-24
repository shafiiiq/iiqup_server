const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const Operator = require('./operator.model')
const Equipment = require('../../equipment/equipment.model')
const User = require('../staff/staff.model')
const otpServices = require('../../otp/otp.service')
const { putObject } = require('#core/s3/s3.config')
const { paginate } = require('#shared/pagination/pagination')
require('dotenv').config()

const httpError = (message, status, extra) => Object.assign(new Error(message), { status, ...extra })

const getAuthUser = async () => {
  const authUser = await User.findOne({ email: process.env.AUTH_USER })
  if (!authUser) throw httpError('Authorization user not found', HTTP.NOT_FOUND)
  return authUser
}

const nextOperatorIdentity = (lastOperator) => {
  const nextSlNo = lastOperator ? (lastOperator.slNo || 0) + 1 : 1
  const nextId = lastOperator ? (lastOperator.id || 0) + 1 : 1
  return { nextSlNo, nextId, paddedSlNo: String(nextSlNo).padStart(3, '0') }
}

const createOperator = async (operatorData) => {
  const existing = await Operator.findOne({ qatarId: operatorData.qatarId })
  if (existing) throw httpError('Operator with this Qatar ID already exists', HTTP.CONFLICT)

  const lastOperator = await Operator.findOne().sort({ slNo: -1 }).lean()
  const { nextSlNo, nextId, paddedSlNo } = nextOperatorIdentity(lastOperator)

  const isHired = operatorData.hired === true || operatorData.sponsorship === 'HIRED'
  operatorData.slNo = nextSlNo
  operatorData.id = nextId
  operatorData.uniqueCode = isHired ? `AL-HIRED-${paddedSlNo}` : `ATE-OP-${paddedSlNo}`

  await getAuthUser()

  return await new Operator(operatorData).save()
}

const verifyOperator = async (qatarId) => {
  if (!qatarId) throw httpError('Qatar ID is required', HTTP.BAD_REQUEST)

  const operator = await Operator.findOne({ qatarId })
  if (!operator) throw httpError('Operator not found', HTTP.NOT_FOUND)

  const authUser = await getAuthUser()
  if (!authUser?.authMail) throw httpError('Authorization email not found', HTTP.INTERNAL_SERVER_ERROR)

  let otpResult
  try {
    otpResult = await otpServices.generateAndSendOTP(authUser.authMail, true, operator.name)
  } catch (otpError) {
    logger.error('[operator.service] verifyOperator', otpError)
    throw httpError('Failed to send OTP', HTTP.INTERNAL_SERVER_ERROR, { details: otpError.message })
  }

  const updatedOperator = await Operator.findOneAndUpdate(
    { qatarId },
    { isVerified: true, updatedAt: Date.now(), verifiedAt: Date.now() },
    { new: true, runValidators: true }
  )
  if (!updatedOperator) throw httpError('Failed to update operator verification status', HTTP.INTERNAL_SERVER_ERROR)

  const response = updatedOperator.toObject()
  response.authMail = authUser.authMail

  const isDemoOperator = qatarId === process.env.DEMO_OPERATOR_QID
  if (isDemoOperator) response.otp_for_demo_opr = otpResult.data?.otp

  return response
}

const uploadProfilePic = async (qatarId, fileName, mimeType) => {
  if (!qatarId || !fileName || !mimeType) {
    throw httpError('Qatar ID, fileName, and mimeType are required', HTTP.BAD_REQUEST)
  }

  const operator = await Operator.findOne({ qatarId })
  if (!operator) throw httpError('Operator not found', HTTP.NOT_FOUND)

  const timestamp = Date.now()
  const fileExtension = fileName.split('.').pop() || 'jpg'
  const finalFileName = `${operator.name.replace(/\s+/g, '-')}-${operator.qatarId}-${timestamp}.${fileExtension}`
  const s3Key = `operators/profiles/${finalFileName}`

  try {
    const uploadUrl = await putObject(fileName, s3Key, mimeType)

    const profilePicData = {
      fileName: finalFileName,
      originalName: fileName,
      filePath: s3Key,
      mimeType,
      uploadDate: new Date(),
      url: s3Key,
    }

    const updatedOperator = await Operator.findOneAndUpdate(
      { qatarId },
      { profilePic: profilePicData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )

    return { uploadUrl, profilePicData, operator: updatedOperator }
  } catch (error) {
    logger.error('[OperatorService] uploadProfilePic S3 error:', error)
    throw httpError('Failed to generate upload URL', HTTP.INTERNAL_SERVER_ERROR)
  }
}

const syncEquipmentCertification = async (operator, oldEquipmentNumber, newEquipmentNumber) => {
  try {
    if (oldEquipmentNumber?.trim()) {
      const oldEquipment = await Equipment.findOne({ regNo: oldEquipmentNumber })
      if (oldEquipment) {
        await Equipment.findOneAndUpdate(
          { regNo: oldEquipmentNumber },
          {
            $set: {
              certificationBody: oldEquipment.certificationBody.filter((c) => c.operatorId !== operator._id.toString()),
              updatedAt: new Date(),
            },
          }
        )
      }
    }

    if (newEquipmentNumber?.trim()) {
      const newEquipment = await Equipment.findOne({ regNo: newEquipmentNumber })
      const alreadyCertified = newEquipment?.certificationBody.some((c) => c.operatorId === operator._id.toString())

      if (newEquipment && !alreadyCertified) {
        await Equipment.findOneAndUpdate(
          { regNo: newEquipmentNumber },
          {
            $push: {
              certificationBody: {
                operatorName: operator.name,
                operatorId: operator._id.toString(),
                assignedAt: new Date(),
              },
            },
            $set: { updatedAt: new Date() },
          }
        )
      }
    }
  } catch (equipmentError) {
    logger.error('[OperatorService] updateOperator equipment sync error:', equipmentError)
  }
}

const updateOperator = async (qatarId, updateData) => {
  if (!qatarId) throw httpError('Qatar ID is required', HTTP.BAD_REQUEST)

  const existing = await Operator.findOne({ qatarId })
  if (!existing) throw httpError('Operator not found', HTTP.NOT_FOUND)

  const equipmentNumberChanged =
    updateData.equipmentNumber !== undefined && updateData.equipmentNumber !== existing.equipmentNumber
  const oldEquipmentNumber = existing.equipmentNumber
  const newEquipmentNumber = updateData.equipmentNumber

  const operator = await Operator.findOneAndUpdate(
    { qatarId },
    { ...updateData, updatedAt: Date.now() },
    { new: true, runValidators: true }
  )
  if (!operator) throw httpError('Operator not found', HTTP.NOT_FOUND)

  if (equipmentNumberChanged) await syncEquipmentCertification(operator, oldEquipmentNumber, newEquipmentNumber)

  return operator
}

const deleteOperator = async (qatarId) => {
  if (!qatarId) throw httpError('Qatar ID is required', HTTP.BAD_REQUEST)

  const operator = await Operator.findOneAndDelete({ qatarId })
  if (!operator) throw httpError('Operator not found', HTTP.NOT_FOUND)

  return operator
}

const getAllOperators = async (pagination) => paginate(Operator, {}, pagination, { sort: { createdAt: -1 } })

const getOperatorByQatarId = async (qatarId) => {
  if (!qatarId) throw httpError('Qatar ID is required', HTTP.BAD_REQUEST)

  const operator = await Operator.findOne({ qatarId })
  if (!operator) throw httpError('Operator not found', HTTP.NOT_FOUND)

  return operator
}

const getOperatorsByNames = async (names) => {
  if (!names || !Array.isArray(names) || names.length === 0) return []
  return Operator.find({ name: { $in: names } }).lean()
}

const getDistinctDesignations = async () => {
  const designations = await Operator.distinct('designation')
  return designations.filter((d) => d && d.trim()).sort()
}

module.exports = {
  createOperator,
  verifyOperator,
  uploadProfilePic,
  updateOperator,
  deleteOperator,
  getAllOperators,
  getOperatorByQatarId,
  getOperatorsByNames,
  getDistinctDesignations,
}