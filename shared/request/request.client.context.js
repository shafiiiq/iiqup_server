const { AsyncLocalStorage } = require('async_hooks')

const CLIENT_TYPE_HEADER_NAME = 'x-client-type'
const MOBILE_CLIENT_TYPE = 'mobile'
const WEB_CLIENT_TYPE = 'web'

const clientContextStorage = new AsyncLocalStorage()

const clientContextMiddleware = (req, res, next) => {
  const clientType = req.get(CLIENT_TYPE_HEADER_NAME) === MOBILE_CLIENT_TYPE ? MOBILE_CLIENT_TYPE : WEB_CLIENT_TYPE
  clientContextStorage.run({ clientType }, next)
}

const isMobileClient = () => clientContextStorage.getStore()?.clientType === MOBILE_CLIENT_TYPE

module.exports = { clientContextMiddleware, isMobileClient }