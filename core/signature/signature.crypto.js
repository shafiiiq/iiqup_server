const crypto = require('crypto')
const { ACTIVATION_CODE_LENGTH } = require('./signature.constant')

const ALGORITHM = 'aes-256-gcm'
const INITIALIZATION_VECTOR_BYTES = 12
const AUTH_TAG_BYTES = 16

const getEncryptionKey = () => {
  const keyHex = process.env.SIGNATURE_ENCRYPTION_KEY
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('SIGNATURE_ENCRYPTION_KEY must be 64 hex characters')
  }
  return Buffer.from(keyHex, 'hex')
}

const encryptBuffer = (plainBuffer) => {
  const initializationVector = crypto.randomBytes(INITIALIZATION_VECTOR_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), initializationVector)
  const encryptedBody = Buffer.concat([cipher.update(plainBuffer), cipher.final()])
  return Buffer.concat([initializationVector, cipher.getAuthTag(), encryptedBody])
}

const decryptBuffer = (encryptedBuffer) => {
  const initializationVector = encryptedBuffer.subarray(0, INITIALIZATION_VECTOR_BYTES)
  const authTag = encryptedBuffer.subarray(INITIALIZATION_VECTOR_BYTES, INITIALIZATION_VECTOR_BYTES + AUTH_TAG_BYTES)
  const encryptedBody = encryptedBuffer.subarray(INITIALIZATION_VECTOR_BYTES + AUTH_TAG_BYTES)
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), initializationVector)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encryptedBody), decipher.final()])
}

const encryptJson = (value) => encryptBuffer(Buffer.from(JSON.stringify(value), 'utf8')).toString('base64')

const decryptJson = (encodedValue) =>
  JSON.parse(decryptBuffer(Buffer.from(encodedValue, 'base64')).toString('utf8'))

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex')

const generateDeviceToken = () => crypto.randomBytes(32).toString('hex')

const generateActivationCode = () =>
  Array.from({ length: ACTIVATION_CODE_LENGTH }, () => crypto.randomInt(0, 10)).join('')

module.exports = {
  encryptBuffer,
  decryptBuffer,
  encryptJson,
  decryptJson,
  sha256Hex,
  generateDeviceToken,
  generateActivationCode,
}