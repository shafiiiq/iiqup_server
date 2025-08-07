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

      const { name, qatarId, equipmentNumber, type } = req.body;
      
      const operator = await OperatorService.createOperator(
        name, 
        qatarId, 
        equipmentNumber, 
        type
      );
      
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
        authMail: process.env.AUTH_OTP_USER_EMAIL,
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
}

module.exports = OperatorController;