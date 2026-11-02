const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')

const REQUIRED_FUNCTION_NAMES = ['buildVersion', 'buildRenderPath']
const REQUIRED_TEXT_NAMES = ['referenceField', 's3Prefix']

const pdfSources = new Map()

const registerPdfSource = (sourceKey, definition) => {
  const missingFunctions = REQUIRED_FUNCTION_NAMES.filter((name) => typeof definition[name] !== 'function')
  const missingTexts = REQUIRED_TEXT_NAMES.filter((name) => typeof definition[name] !== 'string')
  const missingModel = definition.model ? [] : ['model']
  const missing = [...missingFunctions, ...missingTexts, ...missingModel]

  if (missing.length > 0) throw new Error(`PDF source ${sourceKey} is missing: ${missing.join(', ')}`)
  pdfSources.set(sourceKey, definition)
}

const resolvePdfSource = (sourceKey) => {
  const definition = pdfSources.get(sourceKey)
  if (!definition) throw new AppError('Unknown PDF source', HTTP.BAD_REQUEST)
  return definition
}

module.exports = { registerPdfSource, resolvePdfSource }