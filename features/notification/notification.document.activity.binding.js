const { announceDocumentCreated, announceDocumentActivity } = require('./notification.document.activity.service');

const bindDocumentActivity = (sourceKey) => ({
  announceCreated: ({ document, actorUniqueCode }) =>
    announceDocumentCreated({ sourceKey, document, actorUniqueCode }),
  announceActivity: ({ document, actorUniqueCode, activityType, signing }) =>
    announceDocumentActivity({ sourceKey, document, actorUniqueCode, activityType, signing }),
});

module.exports = { bindDocumentActivity };