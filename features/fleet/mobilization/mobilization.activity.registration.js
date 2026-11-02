const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const Mobilization = require('./mobilization.model')

const MOBILIZATION_ACTIVITY_SOURCE_KEY = 'mobilization'
const UNSEEN_WINDOW_DAYS = 7

registerDocumentActivitySource(MOBILIZATION_ACTIVITY_SOURCE_KEY, {
  model: Mobilization,
  referenceField: '_id',
  buildUnseenScope: () => ({ createdAt: { $gte: new Date(Date.now() - UNSEEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) } }),
})

module.exports = { MOBILIZATION_ACTIVITY_SOURCE_KEY }