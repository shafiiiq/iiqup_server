const { renderPageToPdf } = require('#core/pdf/pdf.service')
const { PDF_PAPER_WIDTH_MM, PDF_PAPER_HEIGHT_MM } = require('#core/pdf/document.pdf.constant')

const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildPurchaseOrderFileName = (purchaseorder, { isAmendment = false } = {}) => {
  const vendor = sanitizeFileNamePart(purchaseorder.company?.vendor)
  const equipment = sanitizeFileNamePart((purchaseorder.equipments || []).join(', '))
  const suffix = isAmendment ? '-amendment' : ''
  return `PurchaseOrder-${purchaseorder.purchaseorderCounter}-${vendor}-PurchaseOrder For - ${equipment}${suffix}.pdf`
}

const buildPurchaseOrderDocumentPath = (refNo, { isAmendment = false, parts } = {}) => {
  const encodedRef = encodeURIComponent(refNo)

  if (parts) return `/order/purchase/report/${encodedRef}/parts/${encodeURIComponent(parts)}`

  if (isAmendment) return `/order/purchase/report/${encodedRef}/amendment/true`

  return `/order/purchase/report/${encodedRef}`
}

const readRequestedPurchaseOrderParts = (rawParts) =>
  typeof rawParts === 'string' && /^[A-Za-z0-9,]+$/.test(rawParts) ? rawParts : null

const generatePurchaseOrderPdfBuffer = (refNo, user, parts) =>
  renderPageToPdf(buildPurchaseOrderDocumentPath(refNo, { parts }), user, {
    width: PDF_PAPER_WIDTH_MM,
    height: PDF_PAPER_HEIGHT_MM,
  })

const buildPurchaseOrderFileRecord = (fileName, storedPdf) => ({
  fileName,
  originalName: fileName,
  filePath: storedPdf.s3Key,
  mimeType: 'application/pdf',
  uploadDate: new Date(),
})

module.exports = {
  buildPurchaseOrderFileName,
  buildPurchaseOrderDocumentPath,
  buildPurchaseOrderFileRecord,
  readRequestedPurchaseOrderParts,
  generatePurchaseOrderPdfBuffer,
}