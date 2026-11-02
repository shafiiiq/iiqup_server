const { announceDocumentCreated, announceDocumentActivity } = require('./notification.document.activity.service');

const bindDocumentActivity = (sourceKey) => ({
  announceCreated: ({ document, actorUniqueCode }) =>
    announceDocumentCreated({ sourceKey, document, actorUniqueCode }),
  announceActivity: ({ document, actorUniqueCode, activityType, detail }) =>
    announceDocumentActivity({ sourceKey, document, actorUniqueCode, activityType, detail }),
});

module.exports = { bindDocumentActivity };