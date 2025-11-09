const OperatorService = require('../services/operator-services');
const { validationResult } = require('express-validator');
require('dotenv').config();

class OperatorController {
  static async createOperator(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const operatorData = req.body;

      const operator = await OperatorService.createOperator(operatorData);

      res.status(201).json({
        success: true,
        data: operator,
        authMail: process.env.AUTH_OTP_USER_EMAIL,
        message: 'Operator created successfully'
      });

    } catch (error) {
      console.error('Create Operator Error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create operator',
        ...(error.details && { details: error.details })
      });
    }
  }

  static async verifyOperator(req, res) {
    try {
      const { qatarId } = req.body;      

      if (!qatarId) {
        return res.status(400).json({
          success: false,
          message: 'Qatar ID is required'
        });
      }

      const operator = await OperatorService.verifyOperator(qatarId);

      res.json({
        success: true,
        data: operator,
        authMail: process.env.ADMIN_OTP_USER_EMAIL,
        message: 'Operator verified successfully'
      });

    } catch (error) {
      console.error('Verify Operator Error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to verify operator',
        ...(error.details && { details: error.details })
      });
    }
  }

  static async uploadProfilePic(req, res) {
    try {
      const { qatarId, fileName, mimeType } = req.body;

      if (!qatarId || !fileName || !mimeType) {
        return res.status(400).json({
          success: false,
          message: 'Qatar ID, fileName, and mimeType are required'
        });
      }

      const result = await OperatorService.uploadProfilePic(qatarId, fileName, mimeType);

      res.json({
        success: true,
        data: result,
        message: 'Upload URL generated successfully'
      });

    } catch (error) {
      console.error('Upload Profile Pic Error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
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
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve operators'
      });
    }
  }

  static async getOperatorByQatarId(req, res) {
    try {
      const { qatarId } = req.params;

      const operator = await OperatorService.getOperatorByQatarId(qatarId);

      res.json({
        success: true,
        data: operator,
        message: 'Operator retrieved successfully'
      });

    } catch (error) {
      console.error('Get Operator Error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to retrieve operator'
      });
    }
  }

  static async updateOperator(req, res) {
    try {
      const { qatarId } = req.params;
      const updateData = req.body;

      const operator = await OperatorService.updateOperator(qatarId, updateData);

      res.json({
        success: true,
        data: operator,
        message: 'Operator updated successfully'
      });

    } catch (error) {
      console.error('Update Operator Error:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to update operator'
      });
    }
  }
}

module.exports = OperatorController;