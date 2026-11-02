const { readObjectBuffer } = require('#core/s3/s3.read')
const { resolvePdfSource } = require('./document.pdf.registry')
const { loadPdfDocument } = require('./document.pdf.load')
const { isDocumentPdfCurrent } = require('./document.pdf.status')
const { ensureDocumentPdf } = require('./document.pdf.ensure')
const { buildDocumentPdfS3Key } = require('./document.pdf.job')
const { requestDocumentPdfInBackground } = require('./document.pdf.trigger')

const readDocumentPdf = async ({ sourceKey, documentId, user, version }) => {
  if (version) {
    const definition = resolvePdfSource(sourceKey)
    const document = await loadPdfDocument(definition, documentId)
    if (version !== definition.buildVersion(document)) {
      return readObjectBuffer(buildDocumentPdfS3Key(definition, documentId, version))
    }
  }

  const storedPdf = await ensureDocumentPdf({ sourceKey, documentId, user })
  return readObjectBuffer(storedPdf.s3Key)
}

const resolveCurrentDocumentPdfVersion = async ({ sourceKey, documentId }) => {
  const definition = resolvePdfSource(sourceKey)
  const document = await loadPdfDocument(definition, documentId)
  return definition.buildVersion(document)
}

const checkDocumentPdfReady = async ({ sourceKey, documentId, user }) => {
  const definition = resolvePdfSource(sourceKey)
  const document = await loadPdfDocument(definition, documentId)
  const isReady = isDocumentPdfCurrent(definition, document)
  if (!isReady) requestDocumentPdfInBackground({ sourceKey, documentId, user })
  return isReady
}

module.exports = { readDocumentPdf, resolveCurrentDocumentPdfVersion, checkDocumentPdfReady }