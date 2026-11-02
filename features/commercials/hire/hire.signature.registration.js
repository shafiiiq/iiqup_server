const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const { SIGNATURE_ERROR_CODE } = require('#core/signature/signature.constant')
const HireOrder = require('./hire.model')
const { WORKFLOW_STATUS } = require('./hire.constant')
const { resolveEffectiveContent } = require('./hire.content')
const { hireOrderPdf } = require('./hire.pdf.registration')
const { hireOrderActivity } = require('./hire.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')

const HIRE_ORDER_SOURCE_KEY = 'hire_order'
const MANAGING_DIRECTOR_TITLE = 'MANAGING DIRECTOR'

const SLOT_ID = {
  OPERATIONS_MANAGER: 'operations_manager',
  PURCHASE_MANAGER: 'purchase_manager',
  ACCOUNTS: 'accounts',
  AUTHORIZED_SIGNATORY: 'authorized_signatory',
}

const isManagingDirectorDocument = (hireOrder) =>
  hireOrder.signatures?.authorizedSignatoryTitle === MANAGING_DIRECTOR_TITLE

const buildSlots = (hireOrder) => {
  const isManagingDirector = isManagingDirectorDocument(hireOrder)
  return [
    { slotId: SLOT_ID.OPERATIONS_MANAGER, label: 'Operations Manager', order: 1, allowedRoles: [USER_ROLES.MANAGER] },
    { slotId: SLOT_ID.PURCHASE_MANAGER, label: 'Purchase Manager', order: 2, allowedRoles: [USER_ROLES.PURCHASE_MANAGER] },
    { slotId: SLOT_ID.ACCOUNTS, label: 'Accounts Dept', order: 3, allowedRoles: [USER_ROLES.ACCOUNTANT] },
    {
      slotId: SLOT_ID.AUTHORIZED_SIGNATORY,
      label: isManagingDirector ? 'Managing Director' : 'CEO',
      order: 4,
      allowedRoles: [isManagingDirector ? USER_ROLES.MD : USER_ROLES.CEO],
    },
  ]
}

const resolveSlotEffect = (slotId, hireOrder) => {
  const isManagingDirector = isManagingDirectorDocument(hireOrder)
  const effects = {
    [SLOT_ID.OPERATIONS_MANAGER]: {
      flagField: 'managerSigned',
      detailsKey: 'MANAGER',
      workflowStatus: WORKFLOW_STATUS.MANAGER_APPROVED,
    },
    [SLOT_ID.PURCHASE_MANAGER]: {
      flagField: 'pmSigned',
      detailsKey: 'PMR',
      workflowStatus: WORKFLOW_STATUS.PURCHASE_APPROVED,
    },
    [SLOT_ID.ACCOUNTS]: {
      flagField: 'accountsSigned',
      detailsKey: 'ACCOUNTS',
      workflowStatus: WORKFLOW_STATUS.ACCOUNTS_APPROVED,
    },
    [SLOT_ID.AUTHORIZED_SIGNATORY]: {
      flagField: 'ceoSigned',
      detailsKey: isManagingDirector ? 'MD' : 'CEO',
      workflowStatus: isManagingDirector ? WORKFLOW_STATUS.MD_APPROVED : WORKFLOW_STATUS.CEO_APPROVED,
    },
  }
  return effects[slotId]
}

const loadHireOrder = async (documentId) => {
  const hireOrder = await HireOrder.findOne({ hireOrderRef: documentId })
  if (!hireOrder) throw new AppError('Hire order not found', HTTP.NOT_FOUND)
  return hireOrder
}

const assertHireOrderSignable = (hireOrder) => {
  if (hireOrder.workflowStatus === WORKFLOW_STATUS.CREATED) {
    throw new AppError('HIRE_ORDER_NOT_UPLOADED', HTTP.FORBIDDEN, { code: SIGNATURE_ERROR_CODE.DOCUMENT_NOT_READY })
  }
}

const applyHireOrderSignature = async ({ document, slot, signer, event, wasOverride, ipAddress, userAgent }) => {
  const effect = resolveSlotEffect(slot.slotId, document)
  const detailsPath = `hireOrderDetails.${effect.detailsKey}`

  await HireOrder.updateOne(
    { _id: document._id },
    {
      $set: {
        [effect.flagField]: true,
        workflowStatus: effect.workflowStatus,
        [`${detailsPath}.signed`]: true,
        [`${detailsPath}.authorised`]: true,
        [`${detailsPath}.approvedBy`]: signer.uniqueCode,
        [`${detailsPath}.approvedDate`]: event.signedAt.toISOString(),
        [`${detailsPath}.approvedIP`]: ipAddress,
        [`${detailsPath}.approvedDevice`]: userAgent,
      },
      $push: {
        approvalTrail: {
          approvedBy: signer.uniqueCode,
          role: signer.role,
          action: wasOverride ? 'override_signed' : 'signed',
          comments: wasOverride
            ? `Override signed by ${slot.label} - earlier positions not yet signed`
            : `Signed by ${slot.label}`,
          approvalDate: event.signedAt,
        },
      },
    }
  )

  hireOrderPdf.requestInBackground({ documentId: document.hireOrderRef, user: signer })
  hireOrderActivity.announceActivity({
    document,
    actorUniqueCode: signer.uniqueCode,
    activityType: DOCUMENT_ACTIVITY_TYPE.SIGNED,
    detail: `signed as ${slot.label}`,
  })
  notifyDocumentTasksChanged({ sourceKey: HIRE_ORDER_SOURCE_KEY, documentId: document.hireOrderRef })
}

registerSignatureSource(HIRE_ORDER_SOURCE_KEY, {
  loadDocument: loadHireOrder,
  getSlots: buildSlots,
  getRevision: (hireOrder) => hireOrder.amendments?.length || 0,
  buildCanonicalContent: resolveEffectiveContent,
  assertSignable: assertHireOrderSignable,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: (hireOrder, slotId) => hireOrder[resolveSlotEffect(slotId, hireOrder).flagField] === true,
  onSigned: applyHireOrderSignature,
})

module.exports = { HIRE_ORDER_SOURCE_KEY }