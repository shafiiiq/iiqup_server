const { ensureDocumentPdf } = require('./document.pdf.ensure')
const { requestDocumentPdfInBackground } = require('./document.pdf.trigger')
const { readDocumentPdf, resolveCurrentDocumentPdfVersion } = require('./document.pdf.access')

const bindDocumentPdf = (sourceKey) => ({
  requestInBackground: ({ documentId, user }) => requestDocumentPdfInBackground({ sourceKey, documentId, user }),
  ensure: ({ documentId, user }) => ensureDocumentPdf({ sourceKey, documentId, user }),
  read: ({ documentId, user, version }) => readDocumentPdf({ sourceKey, documentId, user, version }),
  currentVersion: ({ documentId }) => resolveCurrentDocumentPdfVersion({ sourceKey, documentId }),
})

module.exports = { bindDocumentPdf }