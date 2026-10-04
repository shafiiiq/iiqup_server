const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess } = require('#shared/response/response.sender')
const oauthService = require('./oauth.service')

const socialLogin = async (req, res) => {
  try {
    const { provider } = req.params
    const { token, deviceInfo } = req.body
    if (!token) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'token is required' })

    const result = await oauthService.loginWithProvider(provider, token, deviceInfo)
    sendSuccess(res, result)
  } catch (error) {
    logger.error('[oauth.controller] socialLogin', error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

module.exports = { socialLogin }