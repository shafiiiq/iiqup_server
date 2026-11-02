const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { getAccountSource } = require('./oauth.account')
const { createLink, listLinksForAccount, removeLink } = require('./oauth.link.store')
const { assertIdentityAvailable } = require('./oauth.link.guard')
const { verifySocialToken } = require('./oauth.link.token')
const { SOCIAL_LINK_PURPOSE, SUPPORTED_PROVIDERS } = require('./oauth.constant')

const assertAccountType = (accountType) => {
  if (!getAccountSource(accountType)) throw new AppError('Invalid account type', HTTP.BAD_REQUEST)
}

const listLinkedProviders = async (accountType, accountId) => {
  assertAccountType(accountType)
  return {
    status: HTTP.OK,
    success: true,
    data: { links: await listLinksForAccount(accountType, accountId) },
  }
}

const linkProviderToAccount = async ({ accountType, accountId, linkToken }) => {
  assertAccountType(accountType)
  const claims = verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)

  await assertIdentityAvailable(claims.provider, claims.subject, accountId)
  await createLink({
    provider: claims.provider,
    subject: claims.subject,
    accountType,
    accountId,
    email: claims.email,
  })

  return listLinkedProviders(accountType, accountId)
}

const unlinkProviderFromAccount = async ({ accountType, accountId, provider }) => {
  assertAccountType(accountType)
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw new AppError('Unsupported provider', HTTP.BAD_REQUEST)

  await removeLink(accountType, accountId, provider)
  return listLinkedProviders(accountType, accountId)
}

module.exports = { listLinkedProviders, linkProviderToAccount, unlinkProviderFromAccount }