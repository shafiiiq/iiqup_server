const OperatorService = require('../services/operator-services');
require('dotenv').config();

// ─── Validation helpers ───────────────────────────────────────────────────────

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

const sendValidationError = (res, errors) =>
  res.status(400).json({ success: false, message: 'Validation failed', errors });

// ─── Controller ───────────────────────────────────────────────────────────────

class OperatorController {
  static async createOperator(req, res) {
    try {
      const errors = validate(
        {
          name: { required: true },
          qatarId: { required: true }
          // ✅ removed id and slNo — auto-generated now
        },
        req.body
      );
      if (errors.length) return sendValidationError(res, errors);

      const operator = await OperatorService.createOperator(req.body);

      res.status(201).json({
        success: true,
        data: operator,
        authMail: process.env.AUTH_OTP_USER_EMAIL,
        message: 'Operator created successfully'
      });
    } catch (error) {
      console.error('Create Operator Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create operator',
        ...(error.details && { details: error.details })
      });
    }
  }

  static async verifyOperator(req, res) {
    try {
      const errors = validate({ qatarId: { required: true } }, req.body);
      if (errors.length) return sendValidationError(res, errors);

      const operator = await OperatorService.verifyOperator(req.body.qatarId);

      res.json({
        success: true,
        data: operator,
        authMail: process.env.ADMIN_OTP_USER_EMAIL,
        message: 'Operator verified successfully'
      });
    } catch (error) {
      console.error('Verify Operator Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to verify operator',
        ...(error.details && { details: error.details })
      });
    }
  }

  static async uploadProfilePic(req, res) {
    try {
      const errors = validate(
        {
          qatarId: { required: true },
          fileName: { required: true },
          mimeType: { required: true }
        },
        req.body
      );
      if (errors.length) return sendValidationError(res, errors);

      const { qatarId, fileName, mimeType } = req.body;
      const result = await OperatorService.uploadProfilePic(qatarId, fileName, mimeType);

      res.json({
        success: true,
        data: result,
        message: 'Upload URL generated successfully'
      });
    } catch (error) {
      console.error('Upload Profile Pic Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to upload profile picture'
      });
    }
  }

  static async getAllOperators(req, res) {
    try {
      const operators = await OperatorService.getAllOperators();

      res.json({
        success: true,
        data: operators,
        count: operators.length,
        message: 'Operators retrieved successfully'
      });
    } catch (error) {
      console.error('Get All Operators Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve operators'
      });
    }
  }

  static async getOperatorByQatarId(req, res) {
    try {
      const errors = validate({ qatarId: { required: true } }, req.params);
      if (errors.length) return sendValidationError(res, errors);

      const operator = await OperatorService.getOperatorByQatarId(req.params.qatarId);

      res.json({
        success: true,
        data: operator,
        message: 'Operator retrieved successfully'
      });
    } catch (error) {
      console.error('Get Operator Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to retrieve operator'
      });
    }
  }

  static async updateOperator(req, res) {
    try {
      const errors = validate({ id: { required: true } }, req.params);
      if (errors.length) return sendValidationError(res, errors);

      if (req.body.equipmentNumber && req.body.equipmentNumber.trim() !== '') {
        const Equipment = require('../models/equip.model');
        const equipment = await Equipment.findOne({ regNo: req.body.equipmentNumber });

        if (!equipment) {
          console.log("operatorrrrrrrrrrrr heyyyyyyyyyyyyy",);
          return res.status(404).json({
            success: false,
            message: `Equipment with regNo ${req.body.equipmentNumber} not found`
          });
        }
      }

      const operator = await OperatorService.updateOperator(req.params.id, req.body);

      console.log("operatorrrrrrrrrrrr", operator);


      res.json({
        success: true,
        data: operator,
        message: 'Operator updated successfully'
      });
    } catch (error) {
      console.error('Update Operator Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update operator'
      });
    }
  }

  static async deleteOperator(req, res) {
    try {
      const errors = validate({ qatarId: { required: true } }, req.params);
      if (errors.length) return sendValidationError(res, errors);

      await OperatorService.deleteOperator(req.params.qatarId);

      res.json({
        success: true,
        message: 'Operator deleted successfully'
      });
    } catch (error) {
      console.error('Delete Operator Error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete operator'
      });
    }
  }
}

module.exports = OperatorController;