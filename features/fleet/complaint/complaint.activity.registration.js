const { registerDocumentActivitySource } = require('#core/document/document.activity.registry');
const Complaint = require('./complaint.model');
const { COMPLAINT_ACTIVITY_SOURCE_KEY, COMPLAINT_UNSEEN_WINDOW_DAYS } = require('./complaint.constant');

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

registerDocumentActivitySource(COMPLAINT_ACTIVITY_SOURCE_KEY, {
  model: Complaint,
  referenceField: '_id',
  buildUnseenScope: () => ({
    createdAt: { $gte: new Date(Date.now() - COMPLAINT_UNSEEN_WINDOW_DAYS * MILLISECONDS_PER_DAY) },
  }),
});

module.exports = { COMPLAINT_ACTIVITY_SOURCE_KEY };