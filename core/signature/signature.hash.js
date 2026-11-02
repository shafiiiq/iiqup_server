const { sha256Hex } = require('./signature.crypto')

const stableStringify = (value) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const sortedKeys = Object.keys(value).sort()
  return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

const hashDocumentContent = (content) => sha256Hex(stableStringify(content))

module.exports = { stableStringify, hashDocumentContent }