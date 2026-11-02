const { PDF_STATUS } = require('./document.pdf.constant')

const buildDocumentPdfSchemaDefinition = () => ({
  status: { type: String, enum: Object.values(PDF_STATUS) },
  version: { type: String },
  s3Key: { type: String },
  sha256: { type: String },
  generatedAt: { type: Date },
  errorMessage: { type: String },
  failedAt: { type: Date },
})

module.exports = { buildDocumentPdfSchemaDefinition }