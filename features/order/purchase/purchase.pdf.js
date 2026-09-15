const { putObject } = require('#core/s3/s3.config')
const { getPreSignedUrl } = require('#core/s3/s3.service')
const { renderPageToPdf } = require('#core/pdf/pdf.service')
const logger = require('#shared/logger/logger')

const PAPER_WIDTH_MM = 297
const PAPER_HEIGHT_MM = 420

const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildPurchaseOrderFileName = (purchaseorder, { isAmendment = false } = {}) => {
  const vendor = sanitizeFileNamePart(purchaseorder.company?.vendor)
  const equipment = sanitizeFileNamePart((purchaseorder.equipments || []).join(', '))
  const suffix = isAmendment ? '-amendment' : ''
  return `PurchaseOrder-${purchaseorder.purchaseorderCounter}-${vendor}-PurchaseOrder For - ${equipment}${suffix}.pdf`
}

const buildPurchaseOrderDocumentPath = (refNo, { isAmendment = false, complaintId } = {}) => {
  const encodedRef = encodeURIComponent(refNo)

  if (isAmendment) {
    return `/order/purchase/report/${encodedRef}/amendment/true/${complaintId || ''}`
  }

  if (complaintId) {
    return `/order/purchase/report/${encodedRef}/${complaintId}`
  }

  return `/order/purchase/report/${encodedRef}`
}

const generatePurchaseOrderPdfBuffer = async (refNo, user, { isAmendment = false, complaintId } = {}) => {
  const path = buildPurchaseOrderDocumentPath(refNo, { isAmendment, complaintId })
  return renderPageToPdf(path, user, { width: PAPER_WIDTH_MM, height: PAPER_HEIGHT_MM })
}

const getCachedOrRenderPdf = async (purchaseorder, refNo, user, { isAmendment = false, complaintId } = {}) => {
  const cachedFile = purchaseorder.purchaseorderDetails?.purchaseorderFile
  const isCacheValid =
    Boolean(cachedFile?.filePath) &&
    Boolean(cachedFile?.generatedFor) &&
    cachedFile.generatedFor === purchaseorder.updatedAt?.toISOString()

  if (isCacheValid) {
    try {
      const url = await getPreSignedUrl(cachedFile.filePath)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      logger.warn(`[purchase.pdf] cache read failed for ${refNo}, falling back to render:`, error)
    }
  }

  return generatePurchaseOrderPdfBuffer(refNo, user, { isAmendment, complaintId })
}

const uploadPurchaseOrderPdfToS3 = async (buffer, purchaseorderRef, fileName, { updatedAt } = {}) => {
  const s3Key = `purchaseorders/${purchaseorderRef}/${Date.now()}-${fileName}`
  const uploadUrl = await putObject(fileName, s3Key, 'application/pdf')

  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
  })

  if (!s3Response.ok) {
    throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`)
  }

  return {
    fileName,
    originalName: fileName,
    filePath: s3Key,
    mimeType: 'application/pdf',
    uploadUrl,
    uploadDate: new Date(),
    generatedFor: updatedAt || null,
  }
}

module.exports = {
  buildPurchaseOrderFileName,
  buildPurchaseOrderDocumentPath,
  generatePurchaseOrderPdfBuffer,
  getCachedOrRenderPdf,
  uploadPurchaseOrderPdfToS3,
}