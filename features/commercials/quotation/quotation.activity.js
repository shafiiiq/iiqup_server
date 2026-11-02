const { bindDocumentActivity } = require('#features/notification/notification.document.activity.binding')
const { QUOTATION_ACTIVITY_SOURCE_KEY } = require('./quotation.activity.registration')

const quotationActivity = bindDocumentActivity(QUOTATION_ACTIVITY_SOURCE_KEY)

module.exports = { quotationActivity }