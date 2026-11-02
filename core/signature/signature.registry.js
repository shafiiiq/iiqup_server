const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')

const REQUIRED_DEFINITION_FUNCTIONS = [
  'loadDocument',
  'getSlots',
  'getRevision',
  'buildCanonicalContent',
  'assertSignable',
  'canViewDocument',
  'isLegacySigned',
  'onSigned',
]

const signatureSources = new Map()

const registerSignatureSource = (sourceKey, definition) => {
  const missing = REQUIRED_DEFINITION_FUNCTIONS.filter((name) => typeof definition[name] !== 'function')
  if (missing.length > 0) {
    throw new Error(`Signature source ${sourceKey} is missing: ${missing.join(', ')}`)
  }
  signatureSources.set(sourceKey, definition)
}

const resolveSignatureSource = (sourceKey) => {
  const source = signatureSources.get(sourceKey)
  if (!source) throw new AppError('Unknown signature source', HTTP.BAD_REQUEST)
  return source
}

module.exports = { registerSignatureSource, resolveSignatureSource }