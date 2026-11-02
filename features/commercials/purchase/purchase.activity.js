const { bindDocumentActivity } = require('#features/notification/notification.document.activity.binding')
const { PURCHASE_ORDER_ACTIVITY_SOURCE_KEY } = require('./purchase.activity.registration')

const purchaseOrderActivity = bindDocumentActivity(PURCHASE_ORDER_ACTIVITY_SOURCE_KEY)

module.exports = { purchaseOrderActivity }