const { PDF_STATUS } = require('./document.pdf.constant')

const isDocumentPdfCurrent = (definition, document) => {
  const storedPdf = document.pdf
  return (
    storedPdf?.status === PDF_STATUS.READY &&
    Boolean(storedPdf.s3Key) &&
    storedPdf.version === definition.buildVersion(document)
  )
}

module.exports = { isDocumentPdfCurrent }