const { renderPageToPdf } = require('#core/pdf/pdf.service')

const PAPER_WIDTH_MM = 297
const PAPER_HEIGHT_MM = 420

const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildQuotationFileName = (quotation) => {
  const vendor = sanitizeFileNamePart(quotation.company?.vendor)
  return `Quotation-${quotation.quotationCounter}-${vendor}.pdf`
}

const buildQuotationDocumentPath = (refNo, parts) => {
  const base = `/quotation/report/${encodeURIComponent(refNo)}`
  return parts ? `${base}/parts/${encodeURIComponent(parts)}` : base
}

const generateQuotationPdfBuffer = async (refNo, user, parts) => {
  const path = buildQuotationDocumentPath(refNo, parts)
  return renderPageToPdf(path, user, { width: PAPER_WIDTH_MM, height: PAPER_HEIGHT_MM })
}

const buildQuotationFileRecord = (fileName, storedPdf) => ({
  fileName,
  originalName: fileName,
  filePath: storedPdf.s3Key,
  mimeType: 'application/pdf',
  uploadDate: new Date(),
})

module.exports = {
  buildQuotationFileName,
  buildQuotationDocumentPath,
  generateQuotationPdfBuffer,
  buildQuotationFileRecord,
}