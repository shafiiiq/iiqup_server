const { registerPdfSource } = require('#core/pdf/document.pdf.registry')
const { bindDocumentPdf } = require('#core/pdf/document.pdf.binding')
const { buildDocumentPdfVersion } = require('#core/pdf/document.pdf.version')
const Quotation = require('./quotation.model')
const { resolveEffectiveContent } = require('./quotation.content')
const { buildQuotationDocumentPath } = require('./quotation.pdf')

const QUOTATION_PDF_SOURCE_KEY = 'quotation'

const buildQuotationPdfVersion = (quotation) =>
  buildDocumentPdfVersion({
    content: resolveEffectiveContent(quotation),
    original: {
      company: quotation.company,
      location: quotation.location,
      customFields: quotation.customFields,
      requestText: quotation.requestText,
      noticeText: quotation.noticeText,
      priceStatementText: quotation.priceStatementText,
      contactText: quotation.contactText,
      columns: quotation.columns,
      items: quotation.items,
      termsAndConditions: quotation.termsAndConditions,
      showDiscountInTotal: quotation.showDiscountInTotal,
      totalAmount: quotation.totalAmount,
      totalDiscountAmount: quotation.totalDiscountAmount,
    },
    amendments: quotation.amendments,
    signatures: quotation.signatures,
    authorizedSigned: quotation.authorizedSigned,
  })

registerPdfSource(QUOTATION_PDF_SOURCE_KEY, {
  model: Quotation,
  referenceField: 'quotationRef',
  s3Prefix: 'quotations',
  buildVersion: buildQuotationPdfVersion,
  buildRenderPath: (quotation) => buildQuotationDocumentPath(quotation.quotationRef),
})

const quotationPdf = bindDocumentPdf(QUOTATION_PDF_SOURCE_KEY)

module.exports = { QUOTATION_PDF_SOURCE_KEY, quotationPdf }