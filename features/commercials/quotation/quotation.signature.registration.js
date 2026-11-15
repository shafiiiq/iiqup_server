const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const { SIGNATURE_ERROR_CODE } = require('#core/signature/signature.constant')
const { STATUS } = require('./quotation.constant')
const Quotation = require('./quotation.model')
const { resolveEffectiveContent } = require('./quotation.content')
const { quotationPdf } = require('./quotation.pdf.registration')
const { quotationActivity } = require('./quotation.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')

const QUOTATION_SOURCE_KEY = 'quotation'
const MANAGING_DIRECTOR_TITLE = 'MANAGING DIRECTOR'
const AUTHORIZED_SLOT_ID = 'authorized_signatory'

const isManagingDirectorDocument = (quotation) =>
  quotation.signatures?.authorizedSignatoryTitle === MANAGING_DIRECTOR_TITLE

const buildSlots = (quotation) => {
  const isManagingDirector = isManagingDirectorDocument(quotation)
  return [
    {
      slotId: AUTHORIZED_SLOT_ID,
      label: isManagingDirector ? 'Managing Director' : 'CEO',
      order: 1,
      allowedRoles: [isManagingDirector ? USER_ROLES.MD : USER_ROLES.CEO],
    },
  ]
}

const loadQuotation = async (documentId) => {
  const quotation = await Quotation.findOne({ quotationRef: documentId })
  if (!quotation) throw new AppError('Quotation not found', HTTP.NOT_FOUND)
  return quotation
}

const assertQuotationSignable = (quotation) => {
  if (quotation.status === STATUS.DRAFT) {
    throw new AppError('QUOTATION_NOT_SENT', HTTP.FORBIDDEN, { code: SIGNATURE_ERROR_CODE.DOCUMENT_NOT_READY })
  }
}

const applyQuotationSignature = async ({ document, slot, signer, event, ipAddress, userAgent }) => {
  await Quotation.updateOne(
    { _id: document._id },
    {
      $set: {
        authorizedSigned: true,
        signature: {
          signed: true,
          approvedBy: signer.uniqueCode,
          approvedDate: event.signedAt.toISOString(),
          approvedIP: ipAddress,
          approvedDevice: userAgent,
        },
      },
    }
  )

  quotationPdf.requestInBackground({ documentId: document.quotationRef, user: signer })
  quotationActivity.announceActivity({
    document,
    actorUniqueCode: signer.uniqueCode,
    activityType: DOCUMENT_ACTIVITY_TYPE.SIGNED,
    signing: { slotLabel: slot.label, pendingSlotLabels: [] },
  })
  notifyDocumentTasksChanged({ sourceKey: QUOTATION_SOURCE_KEY, documentId: document.quotationRef })
}

registerSignatureSource(QUOTATION_SOURCE_KEY, {
  loadDocument: loadQuotation,
  getSlots: buildSlots,
  getRevision: (quotation) => quotation.amendments?.length || 0,
  buildCanonicalContent: resolveEffectiveContent,
  assertSignable: assertQuotationSignable,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: (quotation) => quotation.authorizedSigned === true && (quotation.amendments?.length || 0) === 0,
  onSigned: applyQuotationSignature,
})

module.exports = { QUOTATION_SOURCE_KEY }