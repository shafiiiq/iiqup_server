const jwt = require('jsonwebtoken')
const { PRINT_TOKEN_TYPE, PRINT_TOKEN_LIFETIME } = require('./pdf.config')

const buildRenderUser = (user) => ({
  id: String(user._id || user.id),
  email: user.email,
  role: user.role,
  uniqueCode: user.uniqueCode,
  userType: user.userType,
  name: user.name,
})

const issuePrintToken = (renderUser) =>
  jwt.sign({ ...renderUser, type: PRINT_TOKEN_TYPE }, process.env.JWT_SECRET, { expiresIn: PRINT_TOKEN_LIFETIME })

module.exports = { buildRenderUser, issuePrintToken }