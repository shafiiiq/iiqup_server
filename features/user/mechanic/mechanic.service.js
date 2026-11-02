const logger = require('#shared/logger/logger');

const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status')
const Mechanic = require('./mechanic.model');
const { verifyQatarAccount, loginQatarAccount } = require('#core/authN/authN.qatar');
const Attendance = require('../../attendance/attendance.model');
const {
  formatValidationError,
  buildAttendanceFilter,
} = require('./mechanic.helper');
const { paginate } = require('#shared/pagination/pagination');
const { putObject } = require('#core/s3/s3.config');

const findMechanicByPin = async (zktecoPin) => {
  const mechanic = await Mechanic.findOne({ zktecoPin: parseInt(zktecoPin) });
  if (!mechanic) throw new AppError('Mechanic not found', HTTP.NOT_FOUND);
  return mechanic;
};

const verifyMechanic = (qatarId) => verifyQatarAccount(Mechanic, qatarId);

const loginMechanic = (qatarId, deviceInfo) =>
  loginQatarAccount({ Model: Mechanic, sessionUserModel: 'Mechanic', qatarId, deviceInfo });

const insertMechanics = async (mechanicData) => {
  try {
    const highest = await Mechanic.findOne().sort({ userId: -1 }).limit(1);
    const nextUserId = highest ? highest.userId + 1 : 1;

    const savedMechanic = await new Mechanic({
      ...mechanicData,
      userId: nextUserId,
    }).save();

    return {
      status: HTTP.CREATED,
      message: 'Mechanic added successfully',
      data: savedMechanic,
    };
  } catch (error) {
    logger.error('[MechanicService] insertMechanics:', error);
    if (error.name === 'ValidationError')
      throw { status: HTTP.BAD_REQUEST, message: formatValidationError(error) };
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error adding mechanic' };
  }
};

const fetchMechanic = async () => {
  try {
    const mechanics = await Mechanic.find();
    return {
      status: HTTP.OK,
      message: 'Mechanics fetched successfully',
      count: mechanics.length,
      data: mechanics,
    };
  } catch (error) {
    logger.error('[MechanicService] fetchMechanic:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error fetching mechanics' };
  }
};

const fetchMechanicById = async (id) => {
  try {
    const mechanics = await Mechanic.findById(id);
    return {
      status: HTTP.OK,
      message: 'Mechanics fetched successfully',
      data: mechanics,
    };
  } catch (error) {
    logger.error('[MechanicService] fetchMechanic:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error fetching mechanics' };
  }
};

const getMechanicById = async (id) => {
  try {
    return await Mechanic.findById(id);
  } catch (error) {
    logger.error('[MechanicService] getMechanicById:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error fetching mechanic' };
  }
};

const mechanicUpdate = async (id, updateData) => {
  try {
    delete updateData.userId;

    const updated = await Mechanic.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError('Mechanic not found', HTTP.NOT_FOUND);

    return {
      status: HTTP.OK,
      message: 'Mechanic updated successfully',
      data: updated,
    };
  } catch (error) {
    logger.error('[MechanicService] mechanicUpdate:', error);
    if (error.name === 'ValidationError')
      throw { status: HTTP.BAD_REQUEST, message: formatValidationError(error) };
    if (error.status) throw error;
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error updating mechanic' };
  }
};

const mechanicDelete = async (id) => {
  try {
    const deleted = await Mechanic.findByIdAndDelete(id);
    if (!deleted) throw new AppError('Mechanic not found', HTTP.NOT_FOUND);

    return { status: HTTP.OK, message: 'Mechanic deleted successfully' };
  } catch (error) {
    logger.error('[MechanicService] mechanicDelete:', error);
    if (error.status) throw error;
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error deleting mechanic' };
  }
};

const addToolkit = async (mechanicId, toolkitData) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) throw { status: HTTP.NOT_FOUND, message: 'Mechanic not found' };

    mechanic.toolkits.push(toolkitData);
    const updated = await mechanic.save();

    return {
      status: HTTP.CREATED,
      message: 'Toolkit added successfully',
      data: updated,
    };
  } catch (error) {
    logger.error('[MechanicService] addToolkit:', error);
    if (error.name === 'ValidationError')
      throw { status: HTTP.BAD_REQUEST, message: formatValidationError(error) };
    if (error.status) throw error;
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error adding toolkit' };
  }
};

const createProfilePhotoUpload = async (mechanicId, fileName, mimeType) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) throw new AppError('Mechanic not found', HTTP.NOT_FOUND);

    const fileExtension = fileName.split('.').pop() || 'jpg';
    const finalFileName = `${mechanic.name.replace(/\s+/g, '-')}-${mechanic._id}-${Date.now()}.${fileExtension}`;
    const s3Key = `mechanics/profiles/${finalFileName}`;

    const uploadUrl = await putObject(fileName, s3Key, mimeType);

    const profilePicData = {
      fileName: finalFileName,
      originalName: fileName,
      filePath: s3Key,
      mimeType,
      uploadDate: new Date(),
      url: s3Key,
    };

    await Mechanic.findByIdAndUpdate(
      mechanicId,
      { $set: { profilePic: profilePicData } },
      { new: true, runValidators: true }
    );

    return {
      status: HTTP.OK,
      message: 'Profile photo upload prepared',
      data: { uploadUrl, profilePicData },
    };
  } catch (error) {
    logger.error('[MechanicService] createProfilePhotoUpload:', error);
    if (error.status) throw error;
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error preparing profile photo upload' };
  }
};

const fetchAttendance = async (zktecoPin, query, pagination) => {
  try {
    const mechanic = await findMechanicByPin(zktecoPin);

    if (query.groupBy === 'month' || query.groupBy === 'year') {
      const groupField = query.groupBy === 'month' ? '$monthYear' : '$year';

      const groups = await Attendance.aggregate([
        { $match: { pin: parseInt(zktecoPin) } },
        { $sort: { punchDateTime: 1 } },
        { $group: { _id: groupField, records: { $push: '$$ROOT' }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]);

      return {
        status: HTTP.OK,
        data: {
          mechanic: { name: mechanic.name, zktecoPin: mechanic.zktecoPin },
          groups,
          totalGroups: groups.length,
        },
      };
    }

    const filter = buildAttendanceFilter(zktecoPin, query);
    const { data, pagination: paginationResult } = await paginate(Attendance, filter, pagination, {
      sort: { punchDateTime: 1 },
    });

    return {
      status: HTTP.OK,
      data: {
        mechanic: { name: mechanic.name, zktecoPin: mechanic.zktecoPin },
        records: data,
        pagination: paginationResult,
      },
    };
  } catch (error) {
    logger.error('[MechanicService] fetchAttendance:', error);
    if (error.status) throw error;
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error fetching attendance' };
  }
};

const fetchRecentActivity = async (limit) => {
  try {
    const parsedLimit = parseInt(limit) > 0 ? parseInt(limit) : 20;

    const records = await Attendance.aggregate([
      { $sort: { punchDateTime: -1 } },
      { $limit: parsedLimit },
      {
        $addFields: {
          pinAsNumber: { $toInt: '$pin' },
        },
      },
      {
        $lookup: {
          from: 'mechanics',
          localField: 'pinAsNumber',
          foreignField: 'zktecoPin',
          as: 'mechanicInfo',
        },
      },
      {
        $addFields: {
          mechanicName: { $arrayElemAt: ['$mechanicInfo.name', 0] },
          mechanicUserId: { $arrayElemAt: ['$mechanicInfo.userId', 0] },
        },
      },
      { $project: { mechanicInfo: 0 } },
    ]);

    return {
      status: HTTP.OK,
      message: 'Recent activity fetched successfully',
      count: records.length,
      data: records,
    };
  } catch (error) {
    logger.error('[MechanicService] fetchRecentActivity:', error);
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Error fetching recent activity' };
  }
};

module.exports = {
  verifyMechanic,
  loginMechanic,
  insertMechanics,
  fetchMechanic,
  fetchMechanicById,
  getMechanicById,
  mechanicUpdate,
  mechanicDelete,
  addToolkit,
  createProfilePhotoUpload,
  fetchAttendance,
  fetchRecentActivity,
};