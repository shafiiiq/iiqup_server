const logger = require('#shared/logger/logger')
const { buildApnsHeaders, dispatchMessageToUser } = require('#core/notification/push/push.fcm')
const { DELEGATION_REQUEST_EVENT } = require('./signature.constant')
const { notifySafely } = require('#features/notification/notification.dispatcher')

const buildRequestPushMessage = ({ delegationId, delegateName, slotLabel }) => {
  const title = 'Signing permission request'
  const body = `${delegateName} asks to sign the ${slotLabel} position with their own signature. Tap to review.`
  return {
    notification: { title, body },
    data: { kind: DELEGATION_REQUEST_EVENT, requestId: String(delegationId) },
    apns: {
      headers: buildApnsHeaders(`delegation_${delegationId}`),
      payload: { aps: { alert: { title, body }, sound: 'default' } },
    },
    android: { priority: 'high', notification: { channelId: 'urgent', sound: 'default' } },
  }
}

const notifyDelegationRequest = async ({ owner, delegate, delegation, slotLabel }) => {
  try {
    const { dispatchUserWebSocketEvent } = require('#core/socket/socket.io')
    dispatchUserWebSocketEvent(owner.uniqueCode, DELEGATION_REQUEST_EVENT, {
      kind: DELEGATION_REQUEST_EVENT,
      requestId: String(delegation._id),
    })
    await dispatchMessageToUser(
      owner.uniqueCode,
      buildRequestPushMessage({ delegationId: delegation._id, delegateName: delegate.name, slotLabel })
    )
  } catch (error) {
    logger.error('[signature.delegation.notification] notifyDelegationRequest:', error)
  }
}

const notifyDelegationOutcome = ({ actorUniqueCode, recipientUniqueCode, title, body }) => {
  return notifySafely({
    actorUniqueCode,
    recipients: [recipientUniqueCode],
    title,
    body,
    priority: 'high',
  })
}

module.exports = { notifyDelegationRequest, notifyDelegationOutcome }