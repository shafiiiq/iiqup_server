const { PDF_STATUS } = require('./document.pdf.constant')

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false }

const markDocumentPdfPending = (definition, documentId, version) =>
  definition.model.updateOne(
    { [definition.referenceField]: documentId },
    { $set: { 'pdf.status': PDF_STATUS.PENDING, 'pdf.version': version, 'pdf.errorMessage': null } },
    WITHOUT_TIMESTAMP_UPDATE
  )

const markDocumentPdfReady = async (definition, documentId, { version, s3Key, sha256 }) => {
  const result = await definition.model.updateOne(
    { [definition.referenceField]: documentId, 'pdf.version': version },
    {
      $set: {
        'pdf.status': PDF_STATUS.READY,
        'pdf.s3Key': s3Key,
        'pdf.sha256': sha256,
        'pdf.generatedAt': new Date(),
        'pdf.errorMessage': null,
        'pdf.failedAt': null,
      },
    },
    WITHOUT_TIMESTAMP_UPDATE
  )
  return result.modifiedCount > 0
}

const markDocumentPdfFailed = async (definition, documentId, version, errorMessage) => {
  const result = await definition.model.updateOne(
    { [definition.referenceField]: documentId, 'pdf.version': version },
    { $set: { 'pdf.status': PDF_STATUS.FAILED, 'pdf.errorMessage': errorMessage, 'pdf.failedAt': new Date() } },
    WITHOUT_TIMESTAMP_UPDATE
  )
  return result.modifiedCount > 0
}

module.exports = {
  markDocumentPdfPending,
  markDocumentPdfReady,
  markDocumentPdfFailed,
}