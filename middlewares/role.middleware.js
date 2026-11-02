const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')

const requireRoles = (...allowedRoles) => async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' })

    const user = await User.findById(req.user.id).select('role isActive').lean()
    if (!user || !user.isActive || !allowedRoles.includes(user.role)) {
      return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Access denied. Insufficient permissions.' })
    }

    next()
  } catch (error) {
    logger.error('[role.middleware] requireRoles', error)
    return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Access denied. Insufficient permissions.' })
  }
}

module.exports = { requireRoles }