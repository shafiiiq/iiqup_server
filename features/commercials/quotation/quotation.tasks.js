const Quotation = require('./quotation.model')
const { TASK_KIND, TASK_LIST_LIMIT } = require('#shared/tasks/task.constant')
const { buildTaskFilter } = require('#shared/tasks/task.window')
const { buildSignerSlot, resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const { buildTaskEntry } = require('#shared/tasks/task.entry')

const INCOMPLETE_FILTER = { authorizedSigned: { $ne: true } }

const SENT_FOR_APPROVAL_FILTER = { status: { $ne: 'draft' } }

const TASK_FIELDS =
  'quotationRef company.vendor totalAmount totalDiscountAmount authorizedSigned signatures.authorizedSignatoryTitle signature.approvedBy amendments.amendmentDate createdAt updatedAt'

const buildSigners = (quotation) => {
  const authorized = resolveAuthorizedSignatory(quotation.signatures?.authorizedSignatoryTitle)

  return [
    buildSignerSlot({
      label: authorized.label,
      signed: quotation.authorizedSigned,
      signedBy: quotation.signature?.approvedBy,
      fallbackCode: authorized.fallbackCode,
    }),
  ]
}

const getTaskEntries = async (since) => {
  const quotations = await Quotation.find({
    $and: [buildTaskFilter({ since, incompleteFilter: INCOMPLETE_FILTER }), SENT_FOR_APPROVAL_FILTER],
  })
    .select(TASK_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(TASK_LIST_LIMIT)
    .lean()

  return quotations.map((quotation) =>
    buildTaskEntry({
      kind: TASK_KIND.QUOTATION,
      document: quotation,
      reference: quotation.quotationRef,
      party: quotation.company?.vendor ?? '',
      amount: quotation.totalDiscountAmount ?? quotation.totalAmount ?? 0,
      amendmentCount: quotation.amendments?.length || 0,
      signers: buildSigners(quotation),
    })
  )
}

module.exports = { getTaskEntries }