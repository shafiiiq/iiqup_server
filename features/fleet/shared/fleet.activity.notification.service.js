const logger = require('#shared/logger/logger');
const { notifySafely } = require('#features/notification/notification.dispatcher');
const { FLEET_ACTIVITY_SCREEN_KEY } = require('./fleet.activity.notification.constant');

const readActivityRecipientCodes = () => JSON.parse(process.env.STAFF_MAIN || '[]');

const announceFleetRecordActivity = async ({ actorUniqueCode, modelKey, record, buildMessage }) => {
  if (!record?._id) return null;

  try {
    const documentId = String(record._id);
    const message = buildMessage(record);

    return await notifySafely({
      actorUniqueCode,
      recipients: readActivityRecipientCodes(),
      title: message.title,
      body: message.body,
      source: { modelKey, documentId },
      actions: [{ text: 'Open Activity', modelKey, documentId, screenKey: FLEET_ACTIVITY_SCREEN_KEY }],
    });
  } catch (error) {
    logger.error(`[fleet.activity.notification] announceFleetRecordActivity failed: ${error.stack || error.message}`);
    return null;
  }
};

module.exports = { announceFleetRecordActivity };