// services/operator.service.js
const Operator    = require('../models/operator.model');
const Equipment   = require('../models/equipment.model');
const User        = require('../models/user.model');
const otpServices = require('./otp.service');
const { putObject } = require('../aws/s3.aws');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the correct history model based on service type.
 * @param {string} serviceType
 * @returns {Model}
 */
const getAuthUser = async () => {
  const authUser = await User.findOne({ email: process.env.AUTH_USER });
  if (!authUser) throw Object.assign(new Error('Authorization user not found'), { status: 404 });
  return authUser;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new operator with auto-generated slNo, id, and uniqueCode.
 * @param {object} operatorData
 * @returns {Promise<object>}
 */
const createOperator = async (operatorData) => {
  const existing = await Operator.findOne({ qatarId: operatorData.qatarId });
  if (existing) throw Object.assign(new Error('Operator with this Qatar ID already exists'), { status: 409 });

  const lastOperator = await Operator.findOne().sort({ slNo: -1 }).lean();
  const nextSlNo     = lastOperator ? (lastOperator.slNo || 0) + 1 : 1;
  const nextId       = lastOperator ? (lastOperator.id   || 0) + 1 : 1;
  const paddedSlNo   = String(nextSlNo).padStart(3, '0');

  const isHired             = operatorData.hired === true || operatorData.sponsorship === 'HIRED';
  operatorData.slNo         = nextSlNo;
  operatorData.id           = nextId;
  operatorData.uniqueCode   = isHired ? `AL-HIRED-${paddedSlNo}` : `ATE-OP-${paddedSlNo}`;

  await getAuthUser();

  return await new Operator(operatorData).save();
};

/**
 * Verifies an operator by Qatar ID, sends OTP to the auth user's email.
 * @param {string} qatarId
 * @returns {Promise<object>}
 */
const verifyOperator = async (qatarId) => {
  if (!qatarId) throw Object.assign(new Error('Qatar ID is required'), { status: 400 });

  const validOperator = await Operator.findOne({ qatarId });
  if (!validOperator) throw Object.assign(new Error('Operator not found'), { status: 404 });

  const authUser = await getAuthUser();

  let OTP;
  try {
    OTP = await otpServices.generateAndSendOTP(authUser.authMail, true, validOperator.name);
  } catch (otpError) {
    console.error('[OperatorService] verifyOperator OTP error:', otpError);
    throw Object.assign(new Error('Failed to send OTP'), { status: 500, details: otpError.message });
  }

  const updatedOperator = await Operator.findOneAndUpdate(
    { qatarId },
    { isVerified: true, updatedAt: Date.now(), verifiedAt: Date.now() },
    { new: true, runValidators: true }
  );
  if (!updatedOperator) throw Object.assign(new Error('Failed to update operator verification status'), { status: 500 });

  const response = updatedOperator.toObject();
  if (qatarId == process.env.DEMO_OPERATOR_QID || validOperator) {
    response.otp_for_demo_opr = OTP.otp;
  }

  return response;
};

/**
 * Generates a presigned S3 upload URL for an operator's profile picture.
 * @param {string} qatarId
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
const uploadProfilePic = async (qatarId, fileName, mimeType) => {
  if (!qatarId || !fileName || !mimeType) {
    throw Object.assign(new Error('Qatar ID, fileName, and mimeType are required'), { status: 400 });
  }

  const operator = await Operator.findOne({ qatarId });
  if (!operator) throw Object.assign(new Error('Operator not found'), { status: 404 });

  const timestamp     = Date.now();
  const fileExtension = fileName.split('.').pop() || 'jpg';
  const finalFileName = `${operator.name.replace(/\s+/g, '-')}-${operator.qatarId}-${timestamp}.${fileExtension}`;
  const s3Key         = `operators/profiles/${finalFileName}`;

  try {
    const uploadUrl = await putObject(fileName, s3Key, mimeType);

    const profilePicData = { fileName: finalFileName, originalName: fileName, filePath: s3Key, mimeType, uploadDate: new Date(), url: s3Key };

    const updatedOperator = await Operator.findOneAndUpdate(
      { qatarId },
      { profilePic: profilePicData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    return { uploadUrl, profilePicData, operator: updatedOperator };
  } catch (error) {
    console.error('[OperatorService] uploadProfilePic S3 error:', error);
    throw Object.assign(new Error('Failed to generate upload URL'), { status: 500 });
  }
};

/**
 * Updates an operator by ID. Syncs certificationBody on equipment if equipmentNumber changes.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const updateOperator = async (qatarId, updateData) => {
  if (!qatarId) throw Object.assign(new Error('Qatar ID is required'), { status: 400 });

  const existing = await Operator.findOneAndUpdate(qatarId);
  if (!existing) throw Object.assign(new Error('Operator not found'), { status: 404 });

  const equipmentNumberChanged = updateData.equipmentNumber !== undefined && updateData.equipmentNumber !== existing.equipmentNumber;
  const oldEquipmentNumber     = existing.equipmentNumber;
  const newEquipmentNumber     = updateData.equipmentNumber;

  const operator = await Operator.findOneAndUpdate({ qatarId }, { ...updateData, updatedAt: Date.now() }, { new: true, runValidators: true });
  if (!operator) throw Object.assign(new Error('Operator not found'), { status: 404 });

  if (equipmentNumberChanged) {
    try {
      if (oldEquipmentNumber?.trim()) {
        const oldEquipment = await Equipment.findOne({ regNo: oldEquipmentNumber });
        if (oldEquipment) {
          await Equipment.findOneAndUpdate(
            { regNo: oldEquipmentNumber },
            { $set: { certificationBody: oldEquipment.certificationBody.filter(c => c.operatorId !== operator._id.toString()), updatedAt: new Date() } }
          );
        }
      }

      if (newEquipmentNumber?.trim()) {
        const newEquipment = await Equipment.findOne({ regNo: newEquipmentNumber });
        if (newEquipment && !newEquipment.certificationBody.some(c => c.operatorId === operator._id.toString())) {
          await Equipment.findOneAndUpdate(
            { regNo: newEquipmentNumber },
            { $push: { certificationBody: { operatorName: operator.name, operatorId: operator._id.toString(), assignedAt: new Date() } }, $set: { updatedAt: new Date() } }
          );
        }
      }
    } catch (equipmentError) {
      console.error('[OperatorService] updateOperator equipment sync error:', equipmentError);
    }
  }

  return operator;
};

/**
 * Deletes an operator by Qatar ID.
 * @param {string} qatarId
 * @returns {Promise<object>}
 */
const deleteOperator = async (qatarId) => {
  if (!qatarId) throw Object.assign(new Error('Qatar ID is required'), { status: 400 });

  const operator = await Operator.findOneAndDelete({ qatarId });
  if (!operator) throw Object.assign(new Error('Operator not found'), { status: 404 });

  return operator;
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all operators sorted by creation date descending.
 * @returns {Promise<Array>}
 */
const getAllOperators = async () => {
  return await Operator.find().sort({ createdAt: -1 });
};

/**
 * Returns a single operator by Qatar ID.
 * @param {string} qatarId
 * @returns {Promise<object>}
 */
const getOperatorByQatarId = async (qatarId) => {
  if (!qatarId) throw Object.assign(new Error('Qatar ID is required'), { status: 400 });

  const operator = await Operator.findOne({ qatarId });
  if (!operator) throw Object.assign(new Error('Operator not found'), { status: 404 });

  return operator;
};

/**
 * Returns operators whose names are in the provided array.
 * @param {Array<string>} names
 * @returns {Promise<Array>}
 */
const getOperatorsByNames = async (names) => {
  if (!names || !Array.isArray(names) || names.length === 0) return [];
  return await Operator.find({ name: { $in: names } }).lean();
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createOperator,
  verifyOperator,
  uploadProfilePic,
  updateOperator,
  deleteOperator,
  getAllOperators,
  getOperatorByQatarId,
  getOperatorsByNames,
};