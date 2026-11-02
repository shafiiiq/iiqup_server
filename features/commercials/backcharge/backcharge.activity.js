const { bindDocumentActivity } = require('#features/notification/notification.document.activity.binding')
const { BACKCHARGE_ACTIVITY_SOURCE_KEY } = require('./backcharge.activity.registration')

const backchargeActivity = bindDocumentActivity(BACKCHARGE_ACTIVITY_SOURCE_KEY)

module.exports = { backchargeActivity }    