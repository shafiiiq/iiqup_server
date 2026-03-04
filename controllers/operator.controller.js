const OperatorService    = require('../services/operator.service');
const Equipment          = require('../models/equipment.model');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates required and typed fields against a source object.
 *
 * @param {Object} fields - Field rules map { fieldName: { required, isNumeric } }.
 * @param {Object} source - Object to validate against (req.body / req.params).
 * @returns {Array} Array of error objects { field, message }.
 */
const validate = (fields, source) => {
  const errors = [];

  for (const [field, rules] of Object.entries(fields)) {
    const value = source[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    if (rules.isNumeric && value !== undefined && isNaN(Number(value))) {
      errors.push({ field, message: `${field} must be a number` });
    }
  }

  return errors;
};

/**
 * Sends a 400 validation error response.
 *
 * @param {Object} res    - Express response object.
 * @param {Array}  errors - Array of validation error objects.
 */
const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation failed', errors });

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /create-operator
 * Creates a new operator record.
 */
const createOperator = async (req, res) => {
  try {
    const errors = validate({ name: { required: true }, qatarId: { required: true } }, req.body);
    if (errors.length) return sendValidationError(res, errors);

    const operator = await OperatorService.createOperator(req.body);

    res.status(201).json({
      success:  true,
      data:     operator,
      authMail: process.env.AUTH_OTP_USER_EMAIL,
      message:  'Operator created successfully',
    });
  } catch (error) {
    console.error('[Operator] createOperator:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create operator',
      ...(error.details && { details: error.details }),
    });
  }
};

/**
 * POST /verify-operator
 * Verifies an operator by Qatar ID.
 */
const verifyOperator = async (req, res) => {
  try {
    const errors = validate({ qatarId: { required: true } }, req.body);
    if (errors.length) return sendValidationError(res, errors);

    const operator = await OperatorService.verifyOperator(req.body.qatarId);

    res.json({
      success:  true,
      data:     operator,
      authMail: process.env.ADMIN_OTP_USER_EMAIL,
      message:  'Operator verified successfully',
    });
  } catch (error) {
    console.error('[Operator] verifyOperator:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to verify operator',
      ...(error.details && { details: error.details }),
    });
  }
};

/**
 * POST /upload-profile-pic
 * Generates an S3 pre-signed URL for operator profile picture upload.
 */
const uploadProfilePic = async (req, res) => {
  try {
    const errors = validate(
      { qatarId: { required: true }, fileName: { required: true }, mimeType: { required: true } },
      req.body
    );
    if (errors.length) return sendValidationError(res, errors);

    const { qatarId, fileName, mimeType } = req.body;
    const result = await OperatorService.uploadProfilePic(qatarId, fileName, mimeType);

    res.json({
      success: true,
      data:    result,
      message: 'Upload URL generated successfully',
    });
  } catch (error) {
    console.error('[Operator] uploadProfilePic:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to upload profile picture',
    });
  }
};

/**
 * GET /get-all-operators
 * Returns all operator records.
 */
const getAllOperators = async (req, res) => {
  try {
    const operators = await OperatorService.getAllOperators();

    res.json({
      success: true,
      data:    operators,
      count:   operators.length,
      message: 'Operators retrieved successfully',
    });
  } catch (error) {
    console.error('[Operator] getAllOperators:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve operators',
    });
  }
};

/**
 * GET /operators/:qatarId
 * Returns a single operator by Qatar ID.
 */
const getOperatorByQatarId = async (req, res) => {
  try {
    const errors = validate({ qatarId: { required: true } }, req.params);
    if (errors.length) return sendValidationError(res, errors);

    const operator = await OperatorService.getOperatorByQatarId(req.params.qatarId);

    res.json({
      success: true,
      data:    operator,
      message: 'Operator retrieved successfully',
    });
  } catch (error) {
    console.error('[Operator] getOperatorByQatarId:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to retrieve operator',
    });
  }
};

/**
 * PUT /update-operator/:id
 * Updates an operator record. Validates equipment regNo if provided.
 */
const updateOperator = async (req, res) => {
  try {
    const errors = validate({ id: { required: true } }, req.params);
    if (errors.length) return sendValidationError(res, errors);

    if (req.body.equipmentNumber?.trim()) {
      const equipment = await Equipment.findOne({ regNo: req.body.equipmentNumber });
      if (!equipment) {
        return res.status(404).json({
          success: false,
          message: `Equipment with regNo ${req.body.equipmentNumber} not found`,
        });
      }
    }

    const operator = await OperatorService.updateOperator(req.params.id, req.body);

    res.json({
      success: true,
      data:    operator,
      message: 'Operator updated successfully',
    });
  } catch (error) {
    console.error('[Operator] updateOperator:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update operator',
    });
  }
};

/**
 * DELETE /delete-operator/:qatarId
 * Deletes an operator by Qatar ID.
 */
const deleteOperator = async (req, res) => {
  try {
    const errors = validate({ qatarId: { required: true } }, req.params);
    if (errors.length) return sendValidationError(res, errors);

    await OperatorService.deleteOperator(req.params.qatarId);

    res.json({
      success: true,
      message: 'Operator deleted successfully',
    });
  } catch (error) {
    console.error('[Operator] deleteOperator:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to delete operator',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createOperator,
  verifyOperator,
  uploadProfilePic,
  getAllOperators,
  getOperatorByQatarId,
  updateOperator,
  deleteOperator,
};