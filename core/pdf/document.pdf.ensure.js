const { enqueueJob } = require('#core/queue/queue.service')
const { resolvePdfSource } = require('./document.pdf.registry')
const { loadPdfDocument } = require('./document.pdf.load')
const { isDocumentPdfCurrent } = require('./document.pdf.status')
const { markDocumentPdfPending } = require('./document.pdf.store')
const { notifyDocumentPdfStatus } = require('./document.pdf.notify')
const { runDocumentPdfJob } = require('./document.pdf.job')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { PDF_STATUS, PDF_FAILURE_COOLDOWN_MS } = require('./document.pdf.constant')

const isRecentlyFailed = (document, version) =>
  document.pdf?.status === PDF_STATUS.FAILED &&
  document.pdf.version === version &&
  Boolean(document.pdf.failedAt) &&
  Date.now() - new Date(document.pdf.failedAt).getTime() < PDF_FAILURE_COOLDOWN_MS

const ensureDocumentPdf = async ({ sourceKey, documentId, user }) => {
  const definition = resolvePdfSource(sourceKey)
  const document = await loadPdfDocument(definition, documentId)

  if (isDocumentPdfCurrent(definition, document)) {
    const { version, s3Key, sha256 } = document.pdf
    return { version, s3Key, sha256 }
  }

  const version = definition.buildVersion(document)
  if (isRecentlyFailed(document, version)) {
    throw new AppError(document.pdf.errorMessage || 'PDF generation failed', HTTP.INTERNAL_SERVER_ERROR)
  }
  const isAlreadyPending = document.pdf?.status === PDF_STATUS.PENDING && document.pdf.version === version

  if (!isAlreadyPending) {
    await markDocumentPdfPending(definition, documentId, version)
    notifyDocumentPdfStatus({ sourceKey, documentId, version, status: PDF_STATUS.PENDING })
  }

  return enqueueJob(`document-pdf:${sourceKey}:${documentId}:${version}`, () =>
    runDocumentPdfJob({ sourceKey, definition, documentId, version, user })
  )
}

module.exports = { ensureDocumentPdf }