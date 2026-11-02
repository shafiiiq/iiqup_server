const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const { SIGNATURE_ERROR_CODE } = require('#core/signature/signature.constant')
const PurchaseOrder = require('./purchase.model')
const { WORKFLOW_STATUS } = require('./purchase.constant')
const { resolveEffectiveContent } = require('./purchase.content')
const { purchaseOrderPdf } = require('./purchase.pdf.registration')
const { purchaseOrderActivity } = require('./purchase.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')

const PURCHASE_ORDER_SOURCE_KEY = 'purchase_order'
const MANAGING_DIRECTOR_TITLE = 'MANAGING DIRECTOR'

const SLOT_ID = {
  OPERATIONS_MANAGER: 'operations_manager',
  PURCHASE_MANAGER: 'purchase_manager',
  ACCOUNTS: 'accounts',
  AUTHORIZED_SIGNATORY: 'authorized_signatory',
}

const isManagingDirectorDocument = (purchaseorder) =>
  purchaseorder.signatures?.authorizedSignatoryTitle === MANAGING_DIRECTOR_TITLE

const buildSlots = (purchaseorder) => {
  const isManagingDirector = isManagingDirectorDocument(purchaseorder)
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

const resolveSlotEffect = (slotId, purchaseorder) => {
  const isManagingDirector = isManagingDirectorDocument(purchaseorder)
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

const loadPurchaseOrder = async (documentId) => {
  const purchaseorder = await PurchaseOrder.findOne({ purchaseorderRef: documentId })
  if (!purchaseorder) throw new AppError('Purchase Order not found', HTTP.NOT_FOUND)
  return purchaseorder
}

const assertPurchaseOrderSignable = (purchaseorder) => {
  if (purchaseorder.workflowStatus === WORKFLOW_STATUS.PurchaseOrder_CREATED) {
    throw new AppError('PurchaseOrder_NOT_UPLOADED', HTTP.FORBIDDEN, { code: SIGNATURE_ERROR_CODE.DOCUMENT_NOT_READY })
  }
}

const applyPurchaseOrderSignature = async ({ document, slot, signer, event, wasOverride, ipAddress, userAgent }) => {
  const effect = resolveSlotEffect(slot.slotId, document)
  const detailsPath = `purchaseorderDetails.${effect.detailsKey}`

  await PurchaseOrder.updateOne(
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

  purchaseOrderPdf.requestInBackground({ documentId: document.purchaseorderRef, user: signer })
  purchaseOrderActivity.announceActivity({
    document,
    actorUniqueCode: signer.uniqueCode,
    activityType: DOCUMENT_ACTIVITY_TYPE.SIGNED,
    detail: `signed as ${slot.label}`,
  })
  notifyDocumentTasksChanged({ sourceKey: PURCHASE_ORDER_SOURCE_KEY, documentId: document.purchaseorderRef })
}

registerSignatureSource(PURCHASE_ORDER_SOURCE_KEY, {
  loadDocument: loadPurchaseOrder,
  getSlots: buildSlots,
  getRevision: (purchaseorder) => purchaseorder.amendments?.length || 0,
  buildCanonicalContent: resolveEffectiveContent,
  assertSignable: assertPurchaseOrderSignable,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: (purchaseorder, slotId) => purchaseorder[resolveSlotEffect(slotId, purchaseorder).flagField] === true,
  onSigned: applyPurchaseOrderSignature,
})

module.exports = { PURCHASE_ORDER_SOURCE_KEY }