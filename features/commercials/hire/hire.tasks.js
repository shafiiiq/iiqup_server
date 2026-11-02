const HireOrder = require('./hire.model')
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

const SENT_FOR_APPROVAL_FILTER = { workflowStatus: { $ne: 'hire_order_created' } }

const TASK_FIELDS =
  'hireOrderRef company.vendor totalAmount totalDiscountAmount managerSigned pmSigned accountsSigned ceoSigned signatures.authorizedSignatoryTitle hireOrderDetails amendments.amendmentDate createdAt updatedAt'

const buildSigners = (hireOrder) => {
  const details = hireOrder.hireOrderDetails || {}
  const authorized = resolveAuthorizedSignatory(hireOrder.signatures?.authorizedSignatoryTitle)

  return [
    buildSignerSlot({
      label: 'Operations Manager',
      signed: hireOrder.managerSigned,
      signedBy: details.MANAGER?.approvedBy,
      fallbackCode: process.env.MANAGER,
    }),
    buildSignerSlot({
      label: 'Purchase Manager',
      signed: hireOrder.pmSigned,
      signedBy: details.PMR?.approvedBy,
      fallbackCode: process.env.PURCHASE_MANAGER,
    }),
    buildSignerSlot({
      label: 'Accounts Dept',
      signed: hireOrder.accountsSigned,
      signedBy: details.ACCOUNTS?.approvedBy,
      fallbackCode: process.env.ACCOUNTS,
    }),
    buildSignerSlot({
      label: authorized.label,
      signed: hireOrder.ceoSigned,
      signedBy: details[authorized.detailsKey]?.approvedBy,
      fallbackCode: authorized.fallbackCode,
    }),
  ]
}

const getTaskEntries = async (since) => {
  const hireOrders = await HireOrder.find({
    $and: [buildTaskFilter({ since, incompleteFilter: INCOMPLETE_FILTER }), SENT_FOR_APPROVAL_FILTER],
  })
    .select(TASK_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(TASK_LIST_LIMIT)
    .lean()

  return hireOrders.map((hireOrder) =>
    buildTaskEntry({
      kind: TASK_KIND.HIRE_ORDER,
      document: hireOrder,
      reference: hireOrder.hireOrderRef,
      party: hireOrder.company?.vendor ?? '',
      amount: hireOrder.totalDiscountAmount ?? hireOrder.totalAmount ?? 0,
      amendmentCount: hireOrder.amendments?.length || 0,
      signers: buildSigners(hireOrder),
    })
  )
}

module.exports = { getTaskEntries }