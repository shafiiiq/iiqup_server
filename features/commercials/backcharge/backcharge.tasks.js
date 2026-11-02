const Backcharge = require('./backcharge.model')
const { TASK_KIND, TASK_LIST_LIMIT } = require('#shared/tasks/task.constant')
const { buildTaskFilter } = require('#shared/tasks/task.window')
const { buildSignerSlot, resolveAuthorizedSignatory } = require('#shared/tasks/task.signer')
const { buildTaskEntry } = require('#shared/tasks/task.entry')

const INCOMPLETE_FILTER = {
  $or: [
    { 'signatures.workshopManager.signed': { $ne: true } },
    { 'signatures.purchaseManager.signed': { $ne: true } },
    { 'signatures.operationsManager.signed': { $ne: true } },
    { 'signatures.authorizedSignatory.signed': { $ne: true } },
  ],
}

const SENT_FOR_APPROVAL_FILTER = { status: { $ne: 'draft' } }

const TASK_FIELDS = 'refNo supplierName costSummary.totalCost signatures status createdAt updatedAt'

const buildSigners = (backcharge) => {
  const signatures = backcharge.signatures || {}
  const authorized = resolveAuthorizedSignatory(signatures.authorizedSignatory?.authorizedSignatoryMode)

  return [
    buildSignerSlot({
      label: 'Workshop Manager',
      signed: signatures.workshopManager?.signed,
      signedBy: signatures.workshopManager?.signedBy,
      fallbackCode: process.env.WORKSHOP_MANAGER,
    }),
    buildSignerSlot({
      label: 'Purchase Manager',
      signed: signatures.purchaseManager?.signed,
      signedBy: signatures.purchaseManager?.signedBy,
      fallbackCode: process.env.PURCHASE_MANAGER,
    }),
    buildSignerSlot({
      label: 'Operations Manager',
      signed: signatures.operationsManager?.signed,
      signedBy: signatures.operationsManager?.signedBy,
      fallbackCode: process.env.MANAGER,
    }),
    buildSignerSlot({
      label: authorized.label,
      signed: signatures.authorizedSignatory?.signed,
      signedBy: signatures.authorizedSignatory?.signedBy,
      fallbackCode: authorized.fallbackCode,
    }),
  ]
}

const getTaskEntries = async (since) => {
  const backcharges = await Backcharge.find({
    $and: [buildTaskFilter({ since, incompleteFilter: INCOMPLETE_FILTER }), SENT_FOR_APPROVAL_FILTER],
  })
    .select(TASK_FIELDS)
    .sort({ updatedAt: -1 })
    .limit(TASK_LIST_LIMIT)
    .lean()

  return backcharges.map((backcharge) =>
    buildTaskEntry({
      kind: TASK_KIND.BACKCHARGE,
      document: backcharge,
      reference: backcharge.refNo,
      party: backcharge.supplierName ?? '',
      amount: backcharge.costSummary?.totalCost ?? 0,
      amendmentCount: 0,
      signers: buildSigners(backcharge),
    })
  )
}

module.exports = { getTaskEntries }