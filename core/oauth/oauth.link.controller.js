const linkService = require('./oauth.link.service')
const settingsService = require('./oauth.settings.service')
const { handleLinkRoute } = require('./oauth.route.handler')

const requestStaffLinkOtp = handleLinkRoute('requestStaffLinkOtp', (req) =>
  linkService.requestStaffLinkOtp({ linkToken: req.body.linkToken, email: req.body.email })
)

const verifyStaffLinkOtp = handleLinkRoute('verifyStaffLinkOtp', (req) =>
  linkService.verifyStaffLinkOtp({ linkToken: req.body.linkToken, email: req.body.email, otp: req.body.otp })
)

const confirmSocialLink = handleLinkRoute('confirmSocialLink', (req) =>
  linkService.confirmSocialLink({ confirmToken: req.body.confirmToken, deviceInfo: req.body.deviceInfo })
)

const linkWithQatarId = handleLinkRoute('linkWithQatarId', (req) =>
  linkService.linkWithQatarId({
    linkToken: req.body.linkToken,
    type: req.body.type,
    qatarId: req.body.qatarId,
    deviceInfo: req.body.deviceInfo,
  })
)

const listLinkedProviders = handleLinkRoute('listLinkedProviders', (req) =>
  settingsService.listLinkedProviders(req.user.userType, req.user.id)
)

const linkProviderToAccount = handleLinkRoute('linkProviderToAccount', (req) =>
  settingsService.linkProviderToAccount({
    accountType: req.user.userType,
    accountId: req.user.id,
    linkToken: req.body.linkToken,
  })
)

const unlinkProviderFromAccount = handleLinkRoute('unlinkProviderFromAccount', (req) =>
  settingsService.unlinkProviderFromAccount({
    accountType: req.user.userType,
    accountId: req.user.id,
    provider: req.params.provider,
  })
)

module.exports = {
  requestStaffLinkOtp,
  verifyStaffLinkOtp,
  confirmSocialLink,
  linkWithQatarId,
  listLinkedProviders,
  linkProviderToAccount,
  unlinkProviderFromAccount,
}