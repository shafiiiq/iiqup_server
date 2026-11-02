const { registerDocumentActivitySource } = require('#core/document/document.activity.registry')
const { resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const Quotation = require('./quotation.model')

const QUOTATION_ACTIVITY_SOURCE_KEY = 'quotation'

const buildQuotationParticipantCodes = (quotation) => [
  resolveAuthorizedSignatory(quotation.signatures?.authorizedSignatoryTitle).fallbackCode,
]

registerDocumentActivitySource(QUOTATION_ACTIVITY_SOURCE_KEY, {
  model: Quotation,
  referenceField: 'quotationRef',
  buildParticipantCodes: buildQuotationParticipantCodes,
})

module.exports = { QUOTATION_ACTIVITY_SOURCE_KEY }