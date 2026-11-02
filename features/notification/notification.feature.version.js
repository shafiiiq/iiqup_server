const { resolvePdfSource } = require('#core/pdf/document.pdf.registry')
const { loadPdfDocument } = require('#core/pdf/document.pdf.load')

const resolveCurrentPdfVersion = async (sourceKey, document) => {
  const definition = resolvePdfSource(sourceKey)
  const freshDocument = await loadPdfDocument(definition, document[definition.referenceField])
  return definition.buildVersion(freshDocument)
}

module.exports = { resolveCurrentPdfVersion }