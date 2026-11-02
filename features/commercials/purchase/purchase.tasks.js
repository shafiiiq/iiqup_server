const PurchaseOrder = require('./purchase.model')
const { TASK_KIND, TASK_LIST_LIMIT } = require('#shared/tasks/task.constant')
const { buildTaskFilter } = require('#shared/tasks/task.window')
const { buildSignerSlot, resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const { buildTaskEntry } = require('#shared/tasks/task.entry')

const INCOMPLETE_FILTER = {
  $or: [
    { managerSigned: { $ne: true } },
    { pmSigned: { $ne: true } },
    { accountsSigned: { $ne: true } },
    { ceoSigned: { $ne: true } },
  ],
}

const SENT_FOR_APPROVAL_FILTER = { workflowStatus: { $ne: 'purchaseorder_created' } }

const TASK_FIELDS =
  'purchaseorderRef company.vendor totalAmount totalDiscountAmount managerSigned pmSigned accountsSigned ceoSigned signatures.authorizedSignatoryTitle purchaseorderDetails amendments.amendmentDate createdAt updatedAt'

const buildSigners = (purchaseorder) => {
  const details = purchaseorder.purchaseorderDetails || {}
  const authorized = resolveAuthorizedSignatory(purchaseorder.signatures?.authorizedSignatoryTitle)

  return [
    buildSignerSlot({
      label: 'Operations Manager',
      signed: purchaseorder.managerSigned,
      signedBy: details.MANAGER?.approvedBy,
      fallbackCode: process.env.MANAGER,
    }),
    buildSignerSlot({
      label: 'Purchase Manager',
      signed: purchaseorder.pmSigned,
      signedBy: details.PMR?.approvedBy,
      fallbackCode: process.env.PURCHASE_MANAGER,
    }),
    buildSignerSlot({
      label: 'Accounts Dept',
      signed: purchaseorder.accountsSigned,
      signedBy: details.ACCOUNTS?.approvedBy,
      fallbackCode: process.env.ACCOUNTS,
    }),
    buildSignerSlot({
      label: authorized.label,
      signed: purchaseorder.ceoSigned,
      signedBy: details[authorized.detailsKey]?.approvedBy,
      fallbackCode: authorized.fallbackCode,
    }),
  ]
}

const getTaskEntries = async (since) => {
  const purchaseorders = await PurchaseOrder.find({
    $and: [buildTaskFilter({ since, incompleteFilter: INCOMPLETE_FILTER }), SENT_FOR_APPROVAL_FILTER],
  })
    .select(TASK_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(TASK_LIST_LIMIT)
    .lean()

  return purchaseorders.map((purchaseorder) =>
    buildTaskEntry({
      kind: TASK_KIND.PURCHASE_ORDER,
      document: purchaseorder,
      reference: purchaseorder.purchaseorderRef,
      party: purchaseorder.company?.vendor ?? '',
      amount: purchaseorder.totalDiscountAmount || purchaseorder.totalAmount || 0,
      amendmentCount: purchaseorder.amendments?.length || 0,
      signers: buildSigners(purchaseorder),
    })
  )
}

module.exports = { getTaskEntries }