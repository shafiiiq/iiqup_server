const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')

const loadPdfDocument = async (definition, documentId) => {
  const document = await definition.model.findOne({ [definition.referenceField]: documentId }).lean()
  if (!document) throw new AppError('Document not found', HTTP.NOT_FOUND)
  return document
}

module.exports = { loadPdfDocument }