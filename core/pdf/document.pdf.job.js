const logger = require('#shared/logger/logger')
const { uploadStream } = require('#core/s3/s3.config')
const { sha256Hex } = require('#core/signature/signature.crypto')
const { renderPageToPdf } = require('./pdf.service')
const { loadPdfDocument } = require('./document.pdf.load')
const { markDocumentPdfReady, markDocumentPdfFailed } = require('./document.pdf.store')
const { notifyDocumentPdfStatus } = require('./document.pdf.notify')
const {
  PDF_STATUS,
  PDF_RENDER_MAX_ATTEMPTS,
  PDF_PAPER_WIDTH_MM,
  PDF_PAPER_HEIGHT_MM,
  PDF_MIME_TYPE,
} = require('./document.pdf.constant')

const buildDocumentPdfS3Key = (definition, documentId, version) =>
  `${definition.s3Prefix}/${documentId}/pdf/${version}.pdf`

const renderAndStoreDocumentPdf = async ({ sourceKey, definition, documentId, version, user }) => {
  const document = await loadPdfDocument(definition, documentId)
  const pdfBuffer = Buffer.from(
    await renderPageToPdf(definition.buildRenderPath(document), user, {
      width: PDF_PAPER_WIDTH_MM,
      height: PDF_PAPER_HEIGHT_MM,
      renderKey: version,
    })
  )

  const s3Key = buildDocumentPdfS3Key(definition, documentId, version)
  await uploadStream(s3Key, pdfBuffer, PDF_MIME_TYPE)

  const storedPdf = { version, s3Key, sha256: sha256Hex(pdfBuffer) }
  const isLatestVersion = await markDocumentPdfReady(definition, documentId, storedPdf)
  if (isLatestVersion) notifyDocumentPdfStatus({ sourceKey, documentId, version, status: PDF_STATUS.READY })

  return storedPdf
}

const runDocumentPdfJob = async ({ sourceKey, definition, documentId, version, user }) => {
  let lastError = null

  for (let attempt = 1; attempt <= PDF_RENDER_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await renderAndStoreDocumentPdf({ sourceKey, definition, documentId, version, user })
    } catch (error) {
      lastError = error
      logger.warn(`[document.pdf.job] attempt ${attempt} failed for ${sourceKey}:${documentId}:`, error)
    }
  }

  const isLatestVersion = await markDocumentPdfFailed(definition, documentId, version, lastError.message)
  if (isLatestVersion) notifyDocumentPdfStatus({ sourceKey, documentId, version, status: PDF_STATUS.FAILED })
  throw lastError
}

module.exports = { runDocumentPdfJob, buildDocumentPdfS3Key }