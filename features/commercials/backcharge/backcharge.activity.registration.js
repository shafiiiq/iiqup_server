const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const { resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const Backcharge = require('./backcharge.model')

const BACKCHARGE_ACTIVITY_SOURCE_KEY = 'backcharge'

const buildBackchargeParticipantCodes = (backcharge) => [
  process.env.WORKSHOP_MANAGER,
  process.env.PURCHASE_MANAGER,
  process.env.MANAGER,
  resolveAuthorizedSignatory(backcharge.signatures?.authorizedSignatory?.authorizedSignatoryMode).fallbackCode,
]

registerDocumentActivitySource(BACKCHARGE_ACTIVITY_SOURCE_KEY, {
  model: Backcharge,
  referenceField: 'refNo',
  buildParticipantCodes: buildBackchargeParticipantCodes,
})

module.exports = { BACKCHARGE_ACTIVITY_SOURCE_KEY }