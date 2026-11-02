const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const Notification = require('#features/notification/notification.model');
const Complaint = require('./complaint.model');
const { announceComplaintRectified } = require('./complaint.notification');
const ComplaintService = require('./complaint.service');
const { buildMediaFilesFromAttachments } = require('./complaint.helper');
const { COMPLAINT_STATUS, COMPLAINT_NOTIFICATION_SOURCE_KEY } = require('./complaint.constant');

const findComplaintBySource = async (notification) => {
  const source = notification?.source;
  if (source?.modelKey !== COMPLAINT_NOTIFICATION_SOURCE_KEY) return null;
  if (!mongoose.Types.ObjectId.isValid(source.documentId)) return null;
  return Complaint.findById(source.documentId).lean();
};

const findPendingComplaintForNotification = async (notification) => {
  const complaint = await findComplaintBySource(notification);
  if (!complaint) throw new AppError('&rectify works only on complaint notifications', HTTP.BAD_REQUEST);
  if (complaint.status !== COMPLAINT_STATUS.PENDING) throw new AppError('Work already completed', HTTP.CONFLICT);
  return complaint;
};

const findPendingComplaint = async ({ regNo, notificationId }) => {
  if (notificationId && mongoose.Types.ObjectId.isValid(notificationId)) {
    const notification = await Notification.findById(notificationId).select('source').lean();
    const complaint = await findComplaintBySource(notification);
    if (complaint && complaint.regNo === regNo && complaint.status === COMPLAINT_STATUS.PENDING) return complaint;
  }
  return Complaint.findOne({ regNo, status: COMPLAINT_STATUS.PENDING }).sort({ createdAt: 1 }).lean();
};

const completeComplaintFromReply = ({ complaint, remarks, attachments, mechanicName }) =>
  ComplaintService.addSolutionToComplaint(
    complaint._id,
    buildMediaFilesFromAttachments(attachments),
    mechanicName,
    remarks
  );

const rectifyComplaintFromMaintenance = async ({ regNo, notificationId, user, remarks, attachments }) => {
  try {
    const complaint = await findPendingComplaint({ regNo, notificationId });
    if (!complaint) return null;

    await ComplaintService.addSolutionToComplaint(
      complaint._id,
      buildMediaFilesFromAttachments(attachments),
      user.name,
      remarks || ''
    );

    await announceComplaintRectified({
      complaint,
      actorUniqueCode: user.uniqueCode,
      remarks,
      attachments,
      excludedNotificationId: notificationId,
    });
    return complaint;
  } catch (error) {
    logger.error('[complaint.rectification] rectifyComplaintFromMaintenance', error);
    return null;
  }
};

module.exports = {
  findPendingComplaintForNotification,
  completeComplaintFromReply,
  rectifyComplaintFromMaintenance,
};