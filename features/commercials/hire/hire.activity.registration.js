const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const { resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const HireOrder = require('./hire.model')

const HIRE_ORDER_ACTIVITY_SOURCE_KEY = 'hire_order'

const buildHireOrderParticipantCodes = (hireOrder) => [
  process.env.MANAGER,
  process.env.PURCHASE_MANAGER,
  process.env.ACCOUNTS,
  resolveAuthorizedSignatory(hireOrder.signatures?.authorizedSignatoryTitle).fallbackCode,
]

registerDocumentActivitySource(HIRE_ORDER_ACTIVITY_SOURCE_KEY, {
  model: HireOrder,
  referenceField: 'hireOrderRef',
  buildParticipantCodes: buildHireOrderParticipantCodes,
})

module.exports = { HIRE_ORDER_ACTIVITY_SOURCE_KEY }