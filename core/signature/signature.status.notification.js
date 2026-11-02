const logger = require('#shared/logger/logger')
const User = require('#features/user/staff/staff.model')
const { SIGNATURE_STATUS_CHANGED_EVENT } = require('./signature.constant')

const notifySignatureStatusChanged = async (userId) => {
  try {
    const owner = await User.findById(userId).select('uniqueCode').lean()
    if (!owner) return
    const { dispatchUserWebSocketEvent } = require('#core/socket/socket.io')
    dispatchUserWebSocketEvent(owner.uniqueCode, SIGNATURE_STATUS_CHANGED_EVENT, { userId: String(userId) })
  } catch (error) {
    logger.error('[signature.status.notification] notifySignatureStatusChanged:', error)
  }
}

module.exports = { notifySignatureStatusChanged }