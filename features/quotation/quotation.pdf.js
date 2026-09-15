const { putObject } = require('#core/s3/s3.config')
const { getPreSignedUrl } = require('#core/s3/s3.service')
const { renderPageToPdf } = require('#core/pdf/pdf.service')
const logger = require('#shared/logger/logger')

const PAPER_WIDTH_MM = 297
const PAPER_HEIGHT_MM = 420

const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildQuotationFileName = (quotation) => {
  const vendor = sanitizeFileNamePart(quotation.company?.vendor)
  return `Quotation-${quotation.quotationCounter}-${vendor}.pdf`
}

const buildQuotationDocumentPath = (refNo) => `/quotation/report/${encodeURIComponent(refNo)}`

const generateQuotationPdfBuffer = async (refNo, user) => {
  const path = buildQuotationDocumentPath(refNo)
  return renderPageToPdf(path, user, { width: PAPER_WIDTH_MM, height: PAPER_HEIGHT_MM })
}

const getCachedOrRenderPdf = async (quotation, refNo, user) => {
  const cachedFile = quotation.quotationFile
  const isCacheValid =
    Boolean(cachedFile?.filePath) &&
    Boolean(cachedFile?.generatedFor) &&
    cachedFile.generatedFor === quotation.updatedAt?.toISOString()

  if (isCacheValid) {
    try {
      const url = await getPreSignedUrl(cachedFile.filePath)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      logger.warn(`[quotation.pdf] cache read failed for ${refNo}, falling back to render:`, error)
    }
  }

  return generateQuotationPdfBuffer(refNo, user)
}

const uploadQuotationPdfToS3 = async (buffer, quotationRef, fileName, { updatedAt } = {}) => {
  const s3Key = `quotations/${quotationRef}/${Date.now()}-${fileName}`
  const uploadUrl = await putObject(fileName, s3Key, 'application/pdf')

  const s3Response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
  })

  if (!s3Response.ok) throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`)

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
  buildQuotationFileName,
  buildQuotationDocumentPath,
  generateQuotationPdfBuffer,
  getCachedOrRenderPdf,
  uploadQuotationPdfToS3,
}