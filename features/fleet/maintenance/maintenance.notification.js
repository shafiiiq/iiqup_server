const logger = require('#shared/logger/logger');
const User = require('#features/user/staff/staff.model');
const { notifySafely } = require('#features/notification/notification.dispatcher');
const { createReply } = require('#features/notification/notification.reply.service');
const { NOTIFICATION_SOURCE_KEY, NOTIFICATION_RECIPIENT_ROLES } = require('./maintenance.constant');
const {
  buildMaintenanceNotificationTitle,
  buildMaintenanceNotificationBody,
  buildMaintenanceNotificationAttachments,
} = require('./maintenance.notification.content');

const findRecipientCodes = async () => {
  const users = await User.find({ role: { $in: NOTIFICATION_RECIPIENT_ROLES }, isActive: true })
    .select('uniqueCode')
    .lean();
  return users.map((user) => user.uniqueCode);
};

const postMaintenanceReply = ({ maintenance, actorUniqueCode, parentNotificationId }) =>
  createReply({
    notificationId: parentNotificationId,
    uniqueCode: actorUniqueCode,
    text: `${buildMaintenanceNotificationTitle(maintenance)}\n${buildMaintenanceNotificationBody(maintenance)}`,
    attachments: buildMaintenanceNotificationAttachments(maintenance),
  });

const postMaintenanceNotification = ({ maintenance, actorUniqueCode, recipients }) =>
  notifySafely({
    actorUniqueCode,
    recipients,
    title: buildMaintenanceNotificationTitle(maintenance),
    body: buildMaintenanceNotificationBody(maintenance),
    source: { modelKey: NOTIFICATION_SOURCE_KEY, documentId: String(maintenance._id) },
    categoryKey: NOTIFICATION_SOURCE_KEY,
    attachments: buildMaintenanceNotificationAttachments(maintenance),
  });

const announceMaintenanceCreated = async ({ records, actorUniqueCode, parentNotificationId = null }) => {
  try {
    const recipients = parentNotificationId ? [] : await findRecipientCodes();
    for (const record of records) {
      const maintenance = record.toObject();
      if (parentNotificationId) {
        await postMaintenanceReply({ maintenance, actorUniqueCode, parentNotificationId });
      } else {
        await postMaintenanceNotification({ maintenance, actorUniqueCode, recipients });
      }
    }
  } catch (error) {
    logger.error('[maintenance.notification] announceMaintenanceCreated', error);
  }
};

module.exports = { announceMaintenanceCreated };