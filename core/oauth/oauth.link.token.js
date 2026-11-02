const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('#features/user/staff/staff.constant')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')

const signSocialToken = (purpose, claims, expiresIn) => jwt.sign({ ...claims, purpose }, JWT_SECRET, { expiresIn })

const verifySocialToken = (purpose, token) => {
  try {
    const claims = jwt.verify(String(token || ''), JWT_SECRET)
    if (claims.purpose !== purpose) throw new Error('Unexpected token purpose')
    return claims
  } catch {
    throw new AppError('Your session expired. Please start again.', HTTP.BAD_REQUEST)
  }
}

module.exports = { signSocialToken, verifySocialToken }