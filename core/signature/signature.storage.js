const crypto = require('crypto')
const { uploadStream, getObjectStream, objectExists } = require('#core/s3/s3.config')
const { SIGNATURE_S3_PREFIX } = require('./signature.constant')
const { encryptBuffer, decryptBuffer } = require('./signature.crypto')

const ENCRYPTED_CONTENT_TYPE = 'application/octet-stream'

const streamToBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const buildSignatureKey = (userId, version) =>
  `${SIGNATURE_S3_PREFIX}/${userId}/v${version}-${crypto.randomUUID()}.bin`

const storeSignatureImage = (s3Key, pngBuffer) =>
  uploadStream(s3Key, encryptBuffer(pngBuffer), ENCRYPTED_CONTENT_TYPE)

const loadSignatureImage = async (s3Key) => decryptBuffer(await streamToBuffer(await getObjectStream(s3Key)))

const signatureImageExists = (s3Key) => objectExists(s3Key)

module.exports = { buildSignatureKey, storeSignatureImage, loadSignatureImage, signatureImageExists }