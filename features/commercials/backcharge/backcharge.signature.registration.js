const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const { SIGNATURE_ERROR_CODE } = require('#core/signature/signature.constant')
const Backcharge = require('./backcharge.model')
const { resolveEffectiveContent } = require('./backcharge.content')
const { backchargePdf } = require('./backcharge.pdf.registration')
const { backchargeActivity } = require('./backcharge.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')

const BACKCHARGE_SOURCE_KEY = 'backcharge'
const MANAGING_DIRECTOR_MODE = 'MANAGING DIRECTOR'
const DRAFT_STATUS = 'draft'

const SLOT_ID = {
  WORKSHOP_MANAGER: 'workshop_manager',
  PURCHASE_MANAGER: 'purchase_manager',
  OPERATIONS_MANAGER: 'operations_manager',
  AUTHORIZED_SIGNATORY: 'authorized_signatory',
}

const SLOT_FIELD = {
  [SLOT_ID.WORKSHOP_MANAGER]: 'workshopManager',
  [SLOT_ID.PURCHASE_MANAGER]: 'purchaseManager',
  [SLOT_ID.OPERATIONS_MANAGER]: 'operationsManager',
  [SLOT_ID.AUTHORIZED_SIGNATORY]: 'authorizedSignatory',
}

const isManagingDirectorDocument = (backcharge) =>
  backcharge.signatures?.authorizedSignatory?.authorizedSignatoryMode === MANAGING_DIRECTOR_MODE

const buildSlots = (backcharge) => {
  const isManagingDirector = isManagingDirectorDocument(backcharge)
  return [
    { slotId: SLOT_ID.WORKSHOP_MANAGER, label: 'Workshop Manager', order: 1, allowedRoles: [USER_ROLES.WORKSHOP_MANAGER] },
    { slotId: SLOT_ID.PURCHASE_MANAGER, label: 'Purchase Manager', order: 2, allowedRoles: [USER_ROLES.PURCHASE_MANAGER] },
    { slotId: SLOT_ID.OPERATIONS_MANAGER, label: 'Operations Manager', order: 3, allowedRoles: [USER_ROLES.MANAGER] },
    {
      slotId: SLOT_ID.AUTHORIZED_SIGNATORY,
      label: isManagingDirector ? 'Managing Director' : 'CEO',
      order: 4,
      allowedRoles: [isManagingDirector ? USER_ROLES.MD : USER_ROLES.CEO],
    },
  ]
}

const loadBackcharge = async (documentId) => {
  const backcharge = await Backcharge.findOne({ refNo: documentId })
  if (!backcharge) throw new AppError('Backcharge not found', HTTP.NOT_FOUND)
  return backcharge
}

const assertBackchargeSignable = (backcharge) => {
  if (backcharge.status === DRAFT_STATUS) {
    throw new AppError('BACKCHARGE_NOT_SENT', HTTP.FORBIDDEN, { code: SIGNATURE_ERROR_CODE.DOCUMENT_NOT_READY })
  }
}

const applyBackchargeSignature = async ({ document, slot, signer, event, wasOverride, ipAddress, userAgent }) => {
  const signaturePath = `signatures.${SLOT_FIELD[slot.slotId]}`

  await Backcharge.updateOne(
    { _id: document._id },
    {
      $set: {
        [`${signaturePath}.signed`]: true,
        [`${signaturePath}.signedBy`]: signer.uniqueCode,
        [`${signaturePath}.signedDate`]: event.signedAt.toISOString(),
        [`${signaturePath}.signedIP`]: ipAddress,
        [`${signaturePath}.signedDevice`]: userAgent,
      },
      $push: {
        approvalTrail: {
          signedBy: signer.uniqueCode,
          role: signer.role,
          action: wasOverride ? 'override_signed' : 'signed',
          signedDate: event.signedAt,
          comments: wasOverride
            ? `Override signed by ${slot.label} - earlier positions not yet signed`
            : `Signed by ${slot.label}`,
        },
      },
    }
  )

  backchargePdf.requestInBackground({ documentId: document.refNo, user: signer })
  backchargeActivity.announceActivity({
    document,
    actorUniqueCode: signer.uniqueCode,
    activityType: DOCUMENT_ACTIVITY_TYPE.SIGNED,
    detail: `signed as ${slot.label}`,
  })
  notifyDocumentTasksChanged({ sourceKey: BACKCHARGE_SOURCE_KEY, documentId: document.refNo })
}

registerSignatureSource(BACKCHARGE_SOURCE_KEY, {
  loadDocument: loadBackcharge,
  getSlots: buildSlots,
  getRevision: () => 0,
  buildCanonicalContent: resolveEffectiveContent,
  assertSignable: assertBackchargeSignable,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: (backcharge, slotId) => backcharge.signatures?.[SLOT_FIELD[slotId]]?.signed === true,
  onSigned: applyBackchargeSignature,
})

module.exports = { BACKCHARGE_SOURCE_KEY }