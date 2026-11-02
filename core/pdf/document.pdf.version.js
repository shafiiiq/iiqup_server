const { hashDocumentContent } = require('#core/signature/signature.hash')
const { toPlainContent } = require('#core/signature/signature.plain')

const REQUESTED_VERSION_PATTERN = /^[A-Za-z0-9]+$/

const buildDocumentPdfVersion = (versionParts) => hashDocumentContent(toPlainContent(versionParts))

const readRequestedPdfVersion = (value) =>
  typeof value === 'string' && REQUESTED_VERSION_PATTERN.test(value) ? value : undefined

module.exports = { buildDocumentPdfVersion, readRequestedPdfVersion }