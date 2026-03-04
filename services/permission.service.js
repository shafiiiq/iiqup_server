// services/permission.service.js
const { default: mongoose } = require('mongoose');
const User             = require('../models/user.model.js');
const Mechanic         = require('../models/mechanic.model.js');
const { createNotification }        = require('./notification.service.js');
const mechanicServices              = require('./mechanic.service.js');
const { formatDate, convertToAMPM } = require('../helpers/user.helper.js');

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submits an overtime request on behalf of a mechanic.
 * @param {string} mechanicId
 * @param {string} purpose
 * @param {object} data
 * @returns {Promise}
 */
const submitOvertimeRequest = async (mechanicId, purpose, data) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) return { status: 404, message: 'Mechanic not found' };

    let receiver;
    if (purpose === 'overtime') receiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });
    if (!receiver) return { status: 404, message: `No authorized user found to handle ${purpose} requests` };

    const tempRequestId   = new mongoose.Types.ObjectId();
    const finalMediaFiles = (data.mediaFiles || []).map(file => ({
      fileName: file.fileName, originalName: file.originalName, filePath: file.filePath,
      fileSize: 0, mimeType: file.mimeType, type: file.type, uploadDate: file.uploadDate, url: file.filePath
    }));

    receiver.grantAccess.push({
      _id: tempRequestId, purpose,
      data: { ...data, mechanicId, mechanicName: mechanic.name, mechanicUserId: mechanic.userId, requestDate: new Date(), mediaFiles: finalMediaFiles, totalFiles: finalMediaFiles.length },
      granted: false, requestDate: new Date(), status: 'pending'
    });
    await receiver.save();

    try {
      const PushNotificationService = require('../push/notification.push.js');
      const formattedDate           = formatDate(data.date);
      const notificationMessage     = (data.times?.[0]?.in && data.times?.[0]?.out)
        ? `${mechanic.name} is requested to overtime from ${convertToAMPM(data.times[0].in)} to ${convertToAMPM(data.times[0].out)} for ${formattedDate}`
        : `${mechanic.name} has submitted an overtime request for ${formattedDate}`;

      const notification = await createNotification({ title: 'Mechanic overtime request', description: notificationMessage, priority: 'high', type: 'normal' });
      await PushNotificationService.sendGeneralNotification(null, 'Mechanic overtime request', notificationMessage, 'high', 'normal', notification.data._id.toString());
    } catch (notificationError) {
      console.error('[PermissionService] submitOvertimeRequest notification:', notificationError);
    }

    return {
      status: 200, message: `Permission request for ${purpose} has been submitted successfully`,
      data: {
        requestId: tempRequestId, mechanicName: mechanic.name, mechanicUserId: mechanic.userId,
        submittedAt: new Date(), mediaFilesUploaded: finalMediaFiles.length,
        mediaFiles: finalMediaFiles.map(f => ({ fileName: f.fileName, type: f.type, uploadUrl: f.uploadUrl }))
      }
    };
  } catch (error) {
    console.error('[PermissionService] submitOvertimeRequest:', error);
    return { status: 500, message: 'Internal server error', error: error.message };
  }
};

/**
 * Submits a general request (loan, leave, etc).
 * @param {object} data
 * @returns {Promise}
 */
const submitRequest = async (data) => {
  try {
    const user = await User.findOne({ userCode: data.userCode });
    if (!user) return { status: 404, message: 'User not found' };

    let receiver;
    if (data.type === 'loan' || data.type === 'leave') {
      receiver = await User.findOne({ uniqueCode: process.env.OVERTIME_AUTHORISE_CODE });
    }
    if (!receiver) return { status: 404, message: `No authorized user found to handle ${data.type} requests` };

    data.requestDate = new Date();
    receiver.grantAccess.push({ purpose: data.type, data, granted: false, requestDate: new Date(), status: 'pending' });
    await receiver.save();

    return { status: 200, message: `Permission request for ${data.type} has been submitted successfully`, data: { submittedAt: new Date() } };
  } catch (error) {
    console.error('[PermissionService] submitRequest:', error);
    return { status: 500, message: 'Internal server error', error: error.message };
  }
};

/**
 * Approves a pending request and stores the result permanently.
 * @param {string} uniqueCode
 * @param {string} dataId
 * @param {string} purpose
 * @returns {Promise}
 */
const approveRequest = async (uniqueCode, dataId, purpose) => {
  try {
    if (uniqueCode === process.env.WORKSHOP_MANAGER) uniqueCode = process.env.MAINTENANCE_HEAD;

    const user = await User.findOne({ uniqueCode });
    if (!user) return { status: 404, message: 'User not found' };

    const requestIndex = user.grantAccess.findIndex(r => r._id.toString() === dataId && r.purpose === purpose);
    if (requestIndex === -1) return { status: 404, message: 'Request not found' };

    const { mechanicId, ...dataToSend } = user.grantAccess[requestIndex].data;
    user.grantAccess[requestIndex].granted = true;
    await user.save();

    try {
      const response = await mechanicServices.addOvertime(mechanicId, dataToSend);
      if (!response || response.status !== 201) throw new Error(response.message || 'Failed to store data permanently');

      try {
        const updatedUser = await User.findOne({ uniqueCode });
        if (updatedUser) { updatedUser.grantAccess.splice(requestIndex, 1); await updatedUser.save(); }
      } catch (e) {
        console.error('[PermissionService] approveRequest cleanup:', e);
      }

      try {
        const PushNotificationService = require('../push/notification.push.js');
        const mechanic                = await Mechanic.findById(mechanicId);
        const formattedDate           = formatDate(dataToSend.date);
        const notificationMessage     = (dataToSend.times?.[0]?.in && dataToSend.times?.[0]?.out)
          ? `Hamsa is accepted overtime of ${mechanic.name} from ${convertToAMPM(dataToSend.times[0].in)} to ${convertToAMPM(dataToSend.times[0].out)} for ${formattedDate}`
          : `Hamsa is accepted overtime of ${mechanic.name} for ${formattedDate}`;

        const notification = await createNotification({ title: 'Mechanic overtime accepted', description: notificationMessage, priority: 'high', type: 'normal' });
        await PushNotificationService.sendGeneralNotification(null, 'Mechanic overtime accepted', notificationMessage, 'high', 'normal', notification.data._id.toString());
      } catch (notificationError) {
        console.error('[PermissionService] approveRequest notification:', notificationError);
      }

      return { status: 200, message: 'Request approved successfully', data: response.data };
    } catch (error) {
      console.error('[PermissionService] approveRequest processing:', error);
      return { status: 500, message: 'Failed to process the request', error: error.message };
    }
  } catch (error) {
    console.error('[PermissionService] approveRequest:', error);
    return { status: 500, message: 'Internal server error', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches pending requests for a user, optionally filtered by purpose.
 * @param {string} uniqueCode
 * @param {string} purpose
 * @returns {Promise}
 */
const getPendingRequests = async (uniqueCode, purpose) => {
  try {
    if (uniqueCode === process.env.WORKSHOP_MANAGER) uniqueCode = process.env.MAINTENANCE_HEAD;

    const user = await User.findOne({ uniqueCode });
    if (!user) return { status: 404, message: 'User not found', data: null };

    let requests = user.grantAccess || [];
    if (purpose) requests = requests.filter(r => r.purpose === purpose);

    return { status: 200, message: 'Requests fetched successfully', data: requests };
  } catch (error) {
    console.error('[PermissionService] getPendingRequests:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { submitOvertimeRequest, submitRequest, approveRequest, getPendingRequests };