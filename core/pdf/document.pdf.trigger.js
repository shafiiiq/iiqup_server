const logger = require('#shared/logger/logger')
const { ensureDocumentPdf } = require('./document.pdf.ensure')

const requestDocumentPdfInBackground = ({ sourceKey, documentId, user }) => {
  ensureDocumentPdf({ sourceKey, documentId, user }).catch((error) => {
    logger.error(`[document.pdf.trigger] ${sourceKey}:${documentId}:`, error)
  })
}

module.exports = { requestDocumentPdfInBackground }