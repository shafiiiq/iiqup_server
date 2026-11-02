const logger = require('#shared/logger/logger');
const User = require('#features/user/staff/staff.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');
const Notification = require('#features/notification/notification.model');
const { notifySafely } = require('#features/notification/notification.dispatcher');
const { postSystemReply } = require('#features/notification/notification.system.reply.service');
const { normalizeAttachmentInputs } = require('#features/notification/notification.attachment.input');
const {
  COMPLAINT_NOTIFICATION_SOURCE_KEY,
  COMPLAINT_NOTIFICATION_RECIPIENT_ROLES,
} = require('./complaint.constant');

const findRecipientCodes = async () => {
  const [staff, mechanics] = await Promise.all([
    User.find({ role: { $in: COMPLAINT_NOTIFICATION_RECIPIENT_ROLES }, isActive: true }).select('uniqueCode').lean(),
    Mechanic.find({}).select('uniqueCode').lean(),
  ]);
  return [...new Set([...staff, ...mechanics].map((entry) => entry.uniqueCode).filter(Boolean))];
};

const buildComplaintNotificationBody = (complaint) =>
  [[complaint.regNo, complaint.machine].filter(Boolean).join(' - '), complaint.remarks]
    .filter(Boolean)
    .join('\n');

const announceComplaintRegistered = async ({ complaint, actorUniqueCode }) => {
  try {
    const recipients = await findRecipientCodes();
    return await notifySafely({
      actorUniqueCode,
      recipients,
      title: `New complaint ${complaint.complaintId}`,
      body: buildComplaintNotificationBody(complaint),
      priority: 'high',
      source: { modelKey: COMPLAINT_NOTIFICATION_SOURCE_KEY, documentId: String(complaint._id) },
      categoryKey: COMPLAINT_NOTIFICATION_SOURCE_KEY,
    });
  } catch (error) {
    logger.error('[complaint.notification] announceComplaintRegistered', error);
    return null;
  }
};

const buildCompletionText = (remarks) => (remarks ? `completed the work: ${remarks}` : 'completed the work');

const findComplaintNotification = (complaintId) =>
  Notification.findOne({
    'source.modelKey': COMPLAINT_NOTIFICATION_SOURCE_KEY,
    'source.documentId': String(complaintId),
  })
    .select('_id audience')
    .lean();

const announceComplaintRectified = async ({
  complaint,
  actorUniqueCode,
  remarks,
  attachments,
  excludedNotificationId = null,
}) => {
  try {
    if (!actorUniqueCode) return null;
    const complaintNotification = await findComplaintNotification(complaint._id);
    if (!complaintNotification) return null;
    if (String(complaintNotification._id) === String(excludedNotificationId)) return null;

    return await postSystemReply({
      notificationId: complaintNotification._id,
      actorUniqueCode,
      text: buildCompletionText(remarks),
      notifyCodes: complaintNotification.audience,
      pushBody: complaint.complaintId,
      attachments: normalizeAttachmentInputs(attachments),
    });
  } catch (error) {
    logger.error('[complaint.notification] announceComplaintRectified', error);
    return null;
  }
};

module.exports = { announceComplaintRegistered, announceComplaintRectified };