const Operator = require('../models/operator.model');
const User = require('../models/user.model');
const { generateUniqueCode } = require('../utils/code-generator');
const otpServices = require('../services/otp-services');
const { putObject } = require('../s3bucket/s3.bucket');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();


class OperatorService {
  static async createOperator(operatorData) {
    // Check if operator already exists
    const existingOperator = await Operator.findOne({
      $or: [
        { qatarId: operatorData.qatarId },
        { id: operatorData.id }
      ]
    });

    if (existingOperator) {
      const error = new Error('Operator with this Qatar ID or ID already exists');
      error.statusCode = 409;
      throw error;
    }

    // Validate required fields
    const requiredFields = ['name', 'qatarId', 'id', 'slNo'];
    for (const field of requiredFields) {
      if (!operatorData[field]) {
        const error = new Error(`${field} is required`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Generate unique code if not provided
    if (!operatorData.uniqueCode) {
      operatorData.uniqueCode = generateUniqueCode(operatorData.name, operatorData.qatarId);
    }

    const operator = new Operator(operatorData);

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

    let OTP;


    // Send OTP
    try {
      if (qatarId == process.env.DEMO_OPERATOR_QID) {
        OTP = await otpServices.generateAndSendOTP(authUser.authMail, true);
      } else {
        otpServices.generateAndSendOTP(authUser.authMail);
      }
    } catch (otpError) {
      console.error('OTP Send Error:', otpError);
      const error = new Error('Failed to send OTP');
      error.statusCode = 500;
      error.details = otpError.message;
      throw error;
    }

    // Update operator in database (without OTP field)
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

    // Convert to plain object and add OTP for demo operator if applicable
    const response = updatedOperator.toObject();

    if (qatarId == process.env.DEMO_OPERATOR_QID) {
      response.otp_for_demo_opr = OTP.otp;
    }

    return response;
  }

  static async uploadProfilePic(qatarId, fileName, mimeType) {
    if (!qatarId || !fileName || !mimeType) {
      const error = new Error('Qatar ID, fileName, and mimeType are required');
      error.statusCode = 400;
      throw error;
    }

    const operator = await Operator.findOne({ qatarId });
    if (!operator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    // Generate S3 key
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const finalFileName = `${operator.name.replace(/\s+/g, '-')}-${operator.qatarId}-${timestamp}.${fileExtension}`;
    const s3Key = `operators/profiles/${finalFileName}`;

    try {
      // Get presigned upload URL
      const uploadUrl = await putObject(
        fileName,
        s3Key,
        mimeType
      );

      // Prepare profile pic data object (like mediaFiles in complaint)
      const profilePicData = {
        fileName: finalFileName,
        originalName: fileName,
        filePath: s3Key,
        mimeType: mimeType,
        uploadDate: new Date(),
        url: s3Key
      };

      // Update operator with profile pic data
      const updatedOperator = await Operator.findOneAndUpdate(
        { qatarId },
        {
          profilePic: profilePicData,
          updatedAt: Date.now()
        },
        { new: true, runValidators: true }
      );

      return {
        uploadUrl: uploadUrl,
        profilePicData: profilePicData,
        operator: updatedOperator
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      const uploadError = new Error('Failed to generate upload URL');
      uploadError.statusCode = 500;
      throw uploadError;
    }
  }

  static async getAllOperators() {
    return await Operator.find().sort({ createdAt: -1 });
  }

  static async getOperatorByQatarId(qatarId) {
    if (!qatarId) {
      const error = new Error('Qatar ID is required');
      error.statusCode = 400;
      throw error;
    }

    const operator = await Operator.findOne({ qatarId });
    if (!operator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    return operator;
  }

  static async updateOperator(qatarId, updateData) {
    if (!qatarId) {
      const error = new Error('Qatar ID is required');
      error.statusCode = 400;
      throw error;
    }

    const operator = await Operator.findOneAndUpdate(
      { qatarId },
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!operator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    return operator;
  }
}

module.exports = OperatorService;