const { bindDocumentActivity } = require('#features/notification/notification.document.activity.binding')
const { HIRE_ORDER_ACTIVITY_SOURCE_KEY } = require('./hire.activity.registration')

const hireOrderActivity = bindDocumentActivity(HIRE_ORDER_ACTIVITY_SOURCE_KEY)

module.exports = { hireOrderActivity }