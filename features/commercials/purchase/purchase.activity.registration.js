const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const { resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const PurchaseOrder = require('./purchase.model')

const PURCHASE_ORDER_ACTIVITY_SOURCE_KEY = 'purchase_order'

const buildPurchaseOrderParticipantCodes = (purchaseorder) => [
  process.env.MANAGER,
  process.env.PURCHASE_MANAGER,
  process.env.ACCOUNTS,
  resolveAuthorizedSignatory(purchaseorder.signatures?.authorizedSignatoryTitle).fallbackCode,
]

registerDocumentActivitySource(PURCHASE_ORDER_ACTIVITY_SOURCE_KEY, {
  model: PurchaseOrder,
  referenceField: 'purchaseorderRef',
  buildParticipantCodes: buildPurchaseOrderParticipantCodes,
})

module.exports = { PURCHASE_ORDER_ACTIVITY_SOURCE_KEY }