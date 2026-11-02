const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const Replacement = require('./replacement.model')

const REPLACEMENT_ACTIVITY_SOURCE_KEY = 'replacement'
const UNSEEN_WINDOW_DAYS = 7

registerDocumentActivitySource(REPLACEMENT_ACTIVITY_SOURCE_KEY, {
  model: Replacement,
  referenceField: '_id',
  buildUnseenScope: () => ({ createdAt: { $gte: new Date(Date.now() - UNSEEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) } }),
})

module.exports = { REPLACEMENT_ACTIVITY_SOURCE_KEY }