const Operator = require('../models/operator.model');
const User = require('../models/user.model');
const { generateUniqueCode } = require('../utils/code-generator');
const otpServices = require('../services/otp-services');

class OperatorService {
  static async createOperator(name, qatarId, equipmentNumber, type) {
    // Check if operator already exists
    const existingOperator = await Operator.findOne({ qatarId });
    if (existingOperator) {
      const error = new Error('Operator with this Qatar ID already exists');
      error.statusCode = 409;
      throw error;
    }

    // Validate required fields
    if (!name || !qatarId || !equipmentNumber || !type) {
      const error = new Error('All fields are required');
      error.statusCode = 400;
      throw error;
    }

    const uniqueCode = generateUniqueCode(name, qatarId);
    
    const operator = new Operator({
      name,
      qatarId,
      uniqueCode,
      equipmentNumber,
      userType: type
    });

    // Find auth user
    const authUser = await User.findOne({ email: process.env.AUTH_USER });
    if (!authUser) {
      const error = new Error('Authorization user not found');
      error.statusCode = 404;
      throw error;
    }

    // Send OTP
    try {
      await otpServices.generateAndSendOTP(authUser.authMail);
    } catch (otpError) {
      console.error('OTP Send Error:', otpError);
      const error = new Error('Failed to send OTP');
      error.statusCode = 500;
      error.details = otpError.message;
      throw error;
    }

    return await operator.save();
  }

  static async verifyOperator(qatarId) {
    if (!qatarId) {
      const error = new Error('Qatar ID is required');
      error.statusCode = 400;
      throw error;
    }

    const validOperator = await Operator.findOne({ qatarId });
    if (!validOperator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    // Find auth user
    const authUser = await User.findOne({ email: process.env.AUTH_USER });
    if (!authUser) {
      const error = new Error('Authorization user not found');
      error.statusCode = 404;
      throw error;
    }

    // Send OTP
    try {
      await otpServices.generateAndSendOTP(authUser.authMail);
    } catch (otpError) {
      console.error('OTP Send Error:', otpError);
      const error = new Error('Failed to send OTP');
      error.statusCode = 500;
      error.details = otpError.message;
      throw error;
    }

    const updatedOperator = await Operator.findOneAndUpdate(
      { qatarId },
      { 
        isVerified: true, 
        updatedAt: Date.now(),
        verifiedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!updatedOperator) {
      const error = new Error('Failed to update operator verification status');
      error.statusCode = 500;
      throw error;
    }

    return updatedOperator;
  }
}

module.exports = OperatorService;