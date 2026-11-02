const { registerPdfSource } = require('#core/pdf/document.pdf.registry')
const { bindDocumentPdf } = require('#core/pdf/document.pdf.binding')
const { buildDocumentPdfVersion } = require('#core/pdf/document.pdf.version')
const HireOrder = require('./hire.model')
const { resolveEffectiveContent } = require('./hire.content')
const { buildHireOrderDocumentPath } = require('./hire.pdf')

const HIRE_ORDER_PDF_SOURCE_KEY = 'hire_order'

const buildHireOrderPdfVersion = (hireOrder) =>
  buildDocumentPdfVersion({
    content: resolveEffectiveContent(hireOrder),
    original: {
      company: hireOrder.company,
      items: hireOrder.items,
      columns: hireOrder.columns,
      requestText: hireOrder.requestText,
      termsAndConditions: hireOrder.termsAndConditions,
      quoteNo: hireOrder.quoteNo,
      totalAmount: hireOrder.totalAmount,
      totalDiscountAmount: hireOrder.totalDiscountAmount,
    },
    amendmentCount: hireOrder.amendments?.length || 0,
    signatures: hireOrder.signatures,
    signedState: {
      manager: hireOrder.managerSigned,
      purchaseManager: hireOrder.pmSigned,
      accounts: hireOrder.accountsSigned,
      authorized: hireOrder.ceoSigned,
    },
  })

registerPdfSource(HIRE_ORDER_PDF_SOURCE_KEY, {
  model: HireOrder,
  referenceField: 'hireOrderRef',
  s3Prefix: 'hireorders',
  buildVersion: buildHireOrderPdfVersion,
  buildRenderPath: (hireOrder) => buildHireOrderDocumentPath(hireOrder.hireOrderRef),
})

const hireOrderPdf = bindDocumentPdf(HIRE_ORDER_PDF_SOURCE_KEY)

module.exports = { HIRE_ORDER_PDF_SOURCE_KEY, hireOrderPdf }