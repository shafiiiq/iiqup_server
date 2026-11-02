const logger = require('#shared/logger/logger')
const User = require('#features/user/staff/staff.model')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const { dispatchNotificationToUser } = require('#core/notification/push/push.dispatcher')

const findSignupAdmins = () =>
  User.find({ role: { $in: [USER_ROLES.SUPER_ADMIN, USER_ROLES.SUB_ADMIN] }, isActive: true }).select('uniqueCode')

const getSocketGateway = () => require('#core/socket/socket.io')

const broadcastSignupRequestChange = async () => {
  try {
    const admins = await findSignupAdmins()
    admins.forEach((admin) =>
      getSocketGateway().dispatchUserWebSocketEvent(admin.uniqueCode, 'signup_request_update', {
        kind: 'signup_request_update',
      })
    )
  } catch (error) {
    logger.error('[signup.notify] broadcastSignupRequestChange', error)
  }
}

const notifyAdminsOfSignupRequest = async (request) => {
  try {
    const admins = await findSignupAdmins()

    const notificationId = `signup-request-${request._id}`
    const requester = request.email || request.qatarId

    await Promise.allSettled(
      admins.map((admin) =>
        dispatchNotificationToUser(admin.uniqueCode, {
          kind: 'notification',
          notificationId,
          pushId: notificationId,
          title: 'New sign-up request',
          body: `${request.accountType} ${requester} is requesting access. Approval code ${request.approvalCode}`,
          priority: 'high',
        })
      )
    )
  } catch (error) {
    logger.error('[signup.notify] notifyAdminsOfSignupRequest', error)
  }
}

module.exports = { notifyAdminsOfSignupRequest, broadcastSignupRequestChange }