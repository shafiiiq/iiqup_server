const crypto = require('crypto')

const REQUIRED_CURVE = 'prime256v1'

const parsePublicKey = (publicKeyBase64) =>
  crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' })

const isValidDevicePublicKey = (publicKeyBase64) => {
  try {
    const publicKey = parsePublicKey(publicKeyBase64)
    return publicKey.asymmetricKeyType === 'ec' && publicKey.asymmetricKeyDetails?.namedCurve === REQUIRED_CURVE
  } catch {
    return false
  }
}

const buildProofMessage = ({ nonce, sourceKey, documentId, slotId }) => `${nonce}:${sourceKey}:${documentId}:${slotId}`

const verifyProof = ({ publicKey, message, proof }) => {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      { key: parsePublicKey(publicKey), dsaEncoding: 'ieee-p1363' },
      Buffer.from(proof, 'base64')
    )
  } catch {
    return false
  }
}

module.exports = { isValidDevicePublicKey, buildProofMessage, verifyProof }