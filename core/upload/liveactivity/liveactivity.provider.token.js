const crypto = require('crypto')
const {
  APNS_KEY_ID,
  APNS_TEAM_ID,
  APNS_PRIVATE_KEY,
  PROVIDER_TOKEN_LIFETIME_MS,
} = require('./liveactivity.config')

let cachedProviderToken = null
let cachedProviderTokenCreatedAt = 0

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url')

const buildProviderToken = () => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }))
  const claims = encodeBase64Url(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const signingInput = `${header}.${claims}`
  const signature = crypto
    .sign('sha256', Buffer.from(signingInput), { key: APNS_PRIVATE_KEY, dsaEncoding: 'ieee-p1363' })
    .toString('base64url')
  return `${signingInput}.${signature}`
}

const getProviderToken = () => {
  const isExpired = Date.now() - cachedProviderTokenCreatedAt > PROVIDER_TOKEN_LIFETIME_MS
  if (!cachedProviderToken || isExpired) {
    cachedProviderToken = buildProviderToken()
    cachedProviderTokenCreatedAt = Date.now()
  }
  return cachedProviderToken
}

const resetProviderToken = () => {
  cachedProviderToken = null
}

module.exports = {
  getProviderToken,
  resetProviderToken,
}