const { registerPdfSource } = require('#core/pdf/document.pdf.registry')
const { bindDocumentPdf } = require('#core/pdf/document.pdf.binding')
const { buildDocumentPdfVersion } = require('#core/pdf/document.pdf.version')
const PurchaseOrder = require('./purchase.model')
const { resolveEffectiveContent } = require('./purchase.content')
const { buildPurchaseOrderDocumentPath } = require('./purchase.pdf')

const PURCHASE_ORDER_PDF_SOURCE_KEY = 'purchase_order'

const buildPurchaseOrderPdfVersion = (purchaseorder) =>
  buildDocumentPdfVersion({
    content: resolveEffectiveContent(purchaseorder),
    amendmentCount: purchaseorder.amendments?.length || 0,
    isAmendmented: purchaseorder.isAmendmented,
    complaintId: purchaseorder.complaintId,
    totalDiscountAmount: purchaseorder.totalDiscountAmount,
    signatures: purchaseorder.signatures,
    quotationPath: purchaseorder.quotation?.filePath,
    signedState: {
      manager: purchaseorder.managerSigned,
      purchaseManager: purchaseorder.pmSigned,
      accounts: purchaseorder.accountsSigned,
      authorized: purchaseorder.ceoSigned,
    },
  })

registerPdfSource(PURCHASE_ORDER_PDF_SOURCE_KEY, {
  model: PurchaseOrder,
  referenceField: 'purchaseorderRef',
  s3Prefix: 'purchaseorders',
  buildVersion: buildPurchaseOrderPdfVersion,
  buildRenderPath: (purchaseorder) =>
    buildPurchaseOrderDocumentPath(purchaseorder.purchaseorderRef, {
      isAmendment: Boolean(purchaseorder.isAmendmented),
      complaintId: purchaseorder.complaintId || undefined,
    }),
})

const purchaseOrderPdf = bindDocumentPdf(PURCHASE_ORDER_PDF_SOURCE_KEY)

module.exports = { PURCHASE_ORDER_PDF_SOURCE_KEY, purchaseOrderPdf }