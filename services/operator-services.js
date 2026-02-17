const Operator = require('../models/operator.model');
const Equipment = require('../models/equip.model');
const User = require('../models/user.model');
const { generateUniqueCode } = require('../utils/code-generator');
const otpServices = require('../services/otp-services');
const { putObject } = require('../s3bucket/s3.bucket');
const { v4: uuidv4 } = require('uuid');
const { updateEquipments } = require('./equipment-services');
require('dotenv').config();


class OperatorService {
  static async createOperator(operatorData) {
    // Check if operator already exists
    const existingOperator = await Operator.findOne({
      $or: [
        { qatarId: operatorData.qatarId }
      ]
    });

    if (existingOperator) {
      const error = new Error('Operator with this Qatar ID already exists');
      error.statusCode = 409;
      throw error;
    }

    // ✅ Auto-generate slNo and id (find max + 1)
    const lastOperator = await Operator.findOne().sort({ slNo: -1 }).lean();
    const nextSlNo = lastOperator ? (lastOperator.slNo || 0) + 1 : 1;
    const nextId = lastOperator ? (lastOperator.id || 0) + 1 : 1;

    // ✅ Zero-pad to minimum 3 digits
    const paddedSlNo = String(nextSlNo).padStart(3, '0');

    // ✅ Auto-generate uniqueCode based on hired status
    const isHired = operatorData.hired === true || operatorData.sponsorship === 'HIRED';
    const uniqueCode = isHired
      ? `AL-HIRED-${paddedSlNo}`
      : `ATE-OP-${paddedSlNo}`;

    operatorData.slNo = nextSlNo;
    operatorData.id = nextId;
    operatorData.uniqueCode = uniqueCode;

    const operator = new Operator(operatorData);

    const authUser = await User.findOne({ email: process.env.AUTH_USER });
    if (!authUser) {
      const error = new Error('Authorization user not found');
      error.statusCode = 404;
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
      if (qatarId == process.env.DEMO_OPERATOR_QID || validOperator) {
        OTP = await otpServices.generateAndSendOTP(authUser.authMail, true, validOperator.name);
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

    if (qatarId == process.env.DEMO_OPERATOR_QID || validOperator) {
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

  static async updateOperator(id, updateData) {
    if (!id) {
      const error = new Error('ID is required');
      error.statusCode = 400;
      throw error;
    }

    // ✅ Pass id directly, not as object
    const existingOperator = await Operator.findById(id);
    if (!existingOperator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    const isEquipmentNumberChanged = updateData.equipmentNumber !== undefined &&
      updateData.equipmentNumber !== existingOperator.equipmentNumber;

    const oldEquipmentNumber = existingOperator.equipmentNumber;
    const newEquipmentNumber = updateData.equipmentNumber;

    // ✅ findByIdAndUpdate, NOT findByIdAndDelete
    const operator = await Operator.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!operator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    // Equipment sync logic (unchanged)
    if (isEquipmentNumberChanged) {
      try {
        if (oldEquipmentNumber && oldEquipmentNumber.trim() !== '') {
          const oldEquipment = await Equipment.findOne({ regNo: oldEquipmentNumber });
          if (oldEquipment) {
            const updatedCertificationBody = oldEquipment.certificationBody.filter(
              cert => cert.operatorId !== operator._id.toString()
            );
            await Equipment.findOneAndUpdate(
              { regNo: oldEquipmentNumber },
              { $set: { certificationBody: updatedCertificationBody, updatedAt: new Date() } }
            );
          }
        }

        if (newEquipmentNumber && newEquipmentNumber.trim() !== '') {
          const newEquipment = await Equipment.findOne({ regNo: newEquipmentNumber });
          if (newEquipment) {
            const operatorExists = newEquipment.certificationBody.some(
              cert => cert.operatorId === operator._id.toString()
            );
            if (!operatorExists) {
              await Equipment.findOneAndUpdate(
                { regNo: newEquipmentNumber },
                {
                  $push: {
                    certificationBody: {
                      operatorName: operator.name,
                      operatorId: operator._id.toString(),
                      assignedAt: new Date()
                    }
                  },
                  $set: { updatedAt: new Date() }
                }
              );
            }
          }
        }
      } catch (equipmentUpdateError) {
        console.error('Failed to sync equipment when updating operator:', equipmentUpdateError);
      }
    }

    return operator;
  }

  static async deleteOperator(qatarId) {
    if (!qatarId) {
      const error = new Error('Qatar ID is required');
      error.statusCode = 400;
      throw error;
    }

    const operator = await Operator.findOneAndDelete({ qatarId });
    if (!operator) {
      const error = new Error('Operator not found');
      error.statusCode = 404;
      throw error;
    }

    return operator;
  }

  static async getOperatorsByNames(names) {
    if (!names || !Array.isArray(names) || names.length === 0) {
      return [];
    }

    return await Operator.find({
      name: { $in: names }
    }).lean();
  }
}

module.exports = OperatorService;