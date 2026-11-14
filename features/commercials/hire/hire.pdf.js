const { renderPageToPdf } = require('#core/pdf/pdf.service')
const { PDF_PAPER_WIDTH_MM, PDF_PAPER_HEIGHT_MM } = require('#core/pdf/document.pdf.constant')

const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildHireOrderFileName = (hireOrder) =>
  `HireOrder-${hireOrder.hireOrderCounter || ''}-${sanitizeFileNamePart(hireOrder.company?.vendor)}.pdf`

const buildHireOrderDocumentPath = (refNo, { parts } = {}) => {
  const encodedRef = encodeURIComponent(refNo)

  if (parts) return `/order/hire/report/${encodedRef}/parts/${encodeURIComponent(parts)}`

  return `/order/hire/report/${encodedRef}`
}

const readRequestedHireOrderParts = (rawParts) =>
  typeof rawParts === 'string' && /^[A-Za-z0-9,]+$/.test(rawParts) ? rawParts : null

const generateHireOrderPdfBuffer = (refNo, user, parts) =>
  renderPageToPdf(buildHireOrderDocumentPath(refNo, { parts }), user, {
    width: PDF_PAPER_WIDTH_MM,
    height: PDF_PAPER_HEIGHT_MM,
  })

module.exports = {
  buildHireOrderFileName,
  buildHireOrderDocumentPath,
  readRequestedHireOrderParts,
  generateHireOrderPdfBuffer,
}