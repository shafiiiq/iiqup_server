const { recordDocumentCreated, announceDocumentActivity } = require('./notification.document.activity.service');

const bindDocumentActivity = (sourceKey) => ({
  recordCreated: ({ document, actorUniqueCode }) =>
    recordDocumentCreated({ sourceKey, document, actorUniqueCode }),
  announceActivity: ({ document, actorUniqueCode, activityType, signing }) =>
    announceDocumentActivity({ sourceKey, document, actorUniqueCode, activityType, signing }),
});

module.exports = { bindDocumentActivity };