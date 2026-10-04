const { createRemoteJWKSet, jwtVerify } = require('jose')
const logger = require('#shared/logger/logger')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))

const splitEnv = (value) => (value || '').split(',').map((item) => item.trim()).filter(Boolean)

const verifyGoogle = async (token) => {
  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: splitEnv(process.env.GOOGLE_CLIENT_IDS),
  })
  return {
    email: payload.email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: payload.name,
  }
}

const verifyApple = async (token) => {
  const { payload } = await jwtVerify(token, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: splitEnv(process.env.APPLE_CLIENT_ID),
  })
  return {
    email: payload.email,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: null,
  }
}

const verifyFacebook = async (token) => {
  const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
  const debugResponse = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`
  )
  const debug = await debugResponse.json()
  if (!debug.data?.is_valid || debug.data.app_id !== process.env.FACEBOOK_APP_ID) {
    throw new AppError('Invalid social login token', HTTP.UNAUTHORIZED)
  }
  const profileResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`
  )
  const profile = await profileResponse.json()
  return { email: profile.email, emailVerified: !!profile.email, name: profile.name }
}

const VERIFIERS = { google: verifyGoogle, apple: verifyApple, facebook: verifyFacebook }

const verifyProviderToken = async (provider, token) => {
  const verifier = VERIFIERS[provider]
  if (!verifier) throw new AppError('Unsupported provider', HTTP.BAD_REQUEST)
  try {
    return await verifier(token)
  } catch (error) {
    if (error.status) throw error
    logger.error(`[oauth.providers] ${provider}`, error.message)
    throw new AppError('Invalid social login token', HTTP.UNAUTHORIZED)
  }
}

module.exports = { verifyProviderToken }