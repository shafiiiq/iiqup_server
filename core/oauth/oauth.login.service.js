const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { verifyProviderToken } = require('./oauth.providers')
const { findAccountByEmail, findAccountById } = require('./oauth.account')
const { findLinkByIdentity, createLink } = require('./oauth.link.store')
const { signSocialToken } = require('./oauth.link.token')
const { buildLoginResult } = require('./oauth.login.result')
const { SOCIAL_LINK_PURPOSE, LINK_TOKEN_EXPIRY, EMAIL_PROVIDER, EMAIL_LINK_TOKEN_EXPIRY } = require('./oauth.constant')

const loginByExistingLink = async (provider, subject, deviceInfo) => {
  const existingLink = await findLinkByIdentity(provider, subject)
  if (!existingLink) return null

  const match = await findAccountById(existingLink.accountType, existingLink.accountId)
  return match ? buildLoginResult(match.source, match.account, deviceInfo) : null
}

const loginByVerifiedEmail = async (provider, identity, deviceInfo) => {
  if (!identity.email || !identity.emailVerified) return null

  const match = await findAccountByEmail(identity.email.toLowerCase())
  if (!match) return null

  await createLink({
    provider,
    subject: identity.subject,
    accountType: match.source.type,
    accountId: match.account._id,
    email: identity.email,
  })
  return buildLoginResult(match.source, match.account, deviceInfo)
}

const buildLinkRequiredResult = (provider, identity) => ({
  status: HTTP.OK,
  success: true,
  authorized: false,
  needsLinking: true,
  message: 'No account is linked to this social login',
  data: {
    linkToken: signSocialToken(
      SOCIAL_LINK_PURPOSE,
      { provider, subject: identity.subject, email: identity.email || '', name: identity.name || '' },
      provider === EMAIL_PROVIDER ? EMAIL_LINK_TOKEN_EXPIRY : LINK_TOKEN_EXPIRY
    ),
    email: identity.email || '',
    name: identity.name || '',
  },
})

const loginWithIdentity = async (provider, identity, deviceInfo) => {
  const linkedLogin = await loginByExistingLink(provider, identity.subject, deviceInfo)
  if (linkedLogin) return linkedLogin

  const emailLogin = await loginByVerifiedEmail(provider, identity, deviceInfo)
  if (emailLogin) return emailLogin

  return buildLinkRequiredResult(provider, identity)
}

const loginWithProvider = async (provider, token, deviceInfo) => {
  const identity = await verifyProviderToken(provider, token)
  if (!identity.subject) throw new AppError('Invalid social login token', HTTP.BAD_REQUEST)
  return loginWithIdentity(provider, identity, deviceInfo)
}

module.exports = { loginWithProvider, loginWithIdentity, loginByExistingLink }