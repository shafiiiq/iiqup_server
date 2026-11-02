const { fetchPresignedURL } = require('./s3.service')

const resolveOptionalSignedUrl = async (s3Key) => {
  if (!s3Key) return ''
  const result = await fetchPresignedURL(s3Key, false)
  return result.ok ? result.dataUrl : ''
}

module.exports = { resolveOptionalSignedUrl }