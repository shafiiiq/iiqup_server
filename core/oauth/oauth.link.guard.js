const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { findLinkByIdentity } = require('./oauth.link.store')

const assertIdentityAvailable = async (provider, subject, accountId) => {
  const existingLink = await findLinkByIdentity(provider, subject)
  if (existingLink && String(existingLink.accountId) !== String(accountId)) {
    throw new AppError('This social account is already linked to another account', HTTP.CONFLICT)
  }
}

module.exports = { assertIdentityAvailable }