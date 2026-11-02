const { PRINT_TOKEN_TYPE, PRINT_TOKEN_ALLOWED_POST_PATHS } = require('./pdf.config')

const isPrintToken = (decodedToken) => decodedToken.type === PRINT_TOKEN_TYPE

const resolveRequestPath = (request) => request.originalUrl.split('?')[0]

const isRequestAllowedForPrintToken = (request) => {
  if (request.method === 'GET') return true
  return request.method === 'POST' && PRINT_TOKEN_ALLOWED_POST_PATHS.includes(resolveRequestPath(request))
}

module.exports = { isPrintToken, isRequestAllowedForPrintToken }