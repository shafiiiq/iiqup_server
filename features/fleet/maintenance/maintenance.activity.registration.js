const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const Maintenance = require('./maintenance.model')

const MAINTENANCE_ACTIVITY_SOURCE_KEY = 'maintenance'
const LOCAL_TIME_ZONE = 'Asia/Qatar'

const buildTodayDate = () => new Date().toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE })

registerDocumentActivitySource(MAINTENANCE_ACTIVITY_SOURCE_KEY, {
  model: Maintenance,
  referenceField: '_id',
  buildUnseenScope: () => ({ date: buildTodayDate() }),
})

module.exports = { MAINTENANCE_ACTIVITY_SOURCE_KEY }