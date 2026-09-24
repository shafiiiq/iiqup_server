const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const operatorService = require('./operator.service')
const Equipment = require('../../equipment/equipment.model')
require('dotenv').config()

const validate = (fields, source) => {
  const errors = []

  for (const [field, rules] of Object.entries(fields)) {
    const value = source[field]

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` })
      continue
    }

    if (rules.isNumeric && value !== undefined && isNaN(Number(value))) {
      errors.push({ field, message: `${field} must be a number` })
    }
  }

  return errors
}

const sendValidationError = (res, errors) =>
  res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'Validation failed', errors })

const createOperator = async (req, res) => {
  try {
    const errors = validate({ name: { required: true }, qatarId: { required: true } }, req.body)
    if (errors.length) return sendValidationError(res, errors)

    const operator = await operatorService.createOperator(req.body)

    sendSuccess(res, {
      success: true,
      data: operator,
      authMail: process.env.AUTH_OTP_USER_EMAIL,
      message: 'Operator created successfully',
    })
  } catch (error) {
    logger.error('[Operator] createOperator:', error)
    sendError(res, {
      success: false,
      message: error.message || 'Failed to create operator',
      ...(error.details && { details: error.details }),
    })
  }
}

const uploadProfilePic = async (req, res) => {
  try {
    const errors = validate(
      { qatarId: { required: true }, fileName: { required: true }, mimeType: { required: true } },
      req.body
    )
    if (errors.length) return sendValidationError(res, errors)

    const { qatarId, fileName, mimeType } = req.body
    const result = await operatorService.uploadProfilePic(qatarId, fileName, mimeType)

    sendSuccess(res, { success: true, data: result, message: 'Upload URL generated successfully' })
  } catch (error) {
    logger.error('[Operator] uploadProfilePic:', error)
    sendError(res, { success: false, message: error.message || 'Failed to upload profile picture' })
  }
}

const getAllOperators = async (req, res) => {
  try {
    const result = await operatorService.getAllOperators(req.pagination)

    sendSuccess(res, {
      success: true,
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
      message: 'Operators retrieved successfully',
    })
  } catch (error) {
    logger.error('[Operator] getAllOperators:', error)
    sendError(res, { success: false, message: error.message || 'Failed to retrieve operators' })
  }
}

const getOperatorByQatarId = async (req, res) => {
  try {
    const errors = validate({ qatarId: { required: true } }, req.params)
    if (errors.length) return sendValidationError(res, errors)

    const operator = await operatorService.getOperatorByQatarId(req.params.qatarId)

    sendSuccess(res, { success: true, data: operator, message: 'Operator retrieved successfully' })
  } catch (error) {
    logger.error('[Operator] getOperatorByQatarId:', error)
    sendError(res, { success: false, message: error.message || 'Failed to retrieve operator' })
  }
}

const updateOperator = async (req, res) => {
  try {
    const errors = validate({ id: { required: true } }, req.params)
    if (errors.length) return sendValidationError(res, errors)

    if (req.body.equipmentNumber?.trim()) {
      const equipment = await Equipment.findOne({ regNo: req.body.equipmentNumber })
      if (!equipment) {
        return sendError(res, {
          success: false,
          message: `Equipment with regNo ${req.body.equipmentNumber} not found`,
        })
      }
    }

    const operator = await operatorService.updateOperator(req.params.id, req.body)

    sendSuccess(res, { success: true, data: operator, message: 'Operator updated successfully' })
  } catch (error) {
    logger.error('[Operator] updateOperator:', error)
    sendError(res, { success: false, message: error.message || 'Failed to update operator' })
  }
}

const deleteOperator = async (req, res) => {
  try {
    const errors = validate({ qatarId: { required: true } }, req.params)
    if (errors.length) return sendValidationError(res, errors)

    await operatorService.deleteOperator(req.params.qatarId)

    sendSuccess(res, { success: true, message: 'Operator deleted successfully' })
  } catch (error) {
    logger.error('[Operator] deleteOperator:', error)
    sendError(res, { success: false, message: error.message || 'Failed to delete operator' })
  }
}

const getDesignations = async (req, res) => {
  try {
    const designations = await operatorService.getDistinctDesignations()
    sendSuccess(res, { success: true, data: designations, message: 'Designations retrieved successfully' })
  } catch (error) {
    logger.error('[Operator] getDesignations:', error)
    sendError(res, { success: false, message: error.message || 'Failed to retrieve designations' })
  }
}

module.exports = {
  createOperator,
  uploadProfilePic,
  getAllOperators,
  getOperatorByQatarId,
  updateOperator,
  deleteOperator,
  getDesignations,
}