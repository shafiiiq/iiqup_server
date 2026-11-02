const SocialLink = require('./oauth.link.model')

const findLinkByIdentity = (provider, subject) => SocialLink.findOne({ provider, subject })

const createLink = async ({ provider, subject, accountType, accountId, email }) => {
  await SocialLink.deleteMany({ accountType, accountId, provider })
  return SocialLink.create({ provider, subject, accountType, accountId, email: email || '' })
}

const listLinksForAccount = (accountType, accountId) =>
  SocialLink.find({ accountType, accountId }).select('provider email createdAt').lean()

const removeLink = (accountType, accountId, provider) => SocialLink.deleteOne({ accountType, accountId, provider })

const removeAllLinksForAccount = (accountType, accountId) => SocialLink.deleteMany({ accountType, accountId })

module.exports = {
  findLinkByIdentity,
  createLink,
  listLinksForAccount,
  removeLink,
  removeAllLinksForAccount,
}