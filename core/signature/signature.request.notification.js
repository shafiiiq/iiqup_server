const logger = require('#shared/logger/logger')
const { buildApnsHeaders, dispatchMessageToUser } = require('#core/notification/push/push.fcm')

const { ACTIVATION_REQUEST_KIND } = require('./signature.constant')

const ACTIVATION_REQUEST_EVENT = 'signature_activation_request'

const buildPushMessage = ({ requestId, kind, requesterName, browser, operatingSystem }) => {
  const isFamilyRequest = kind === ACTIVATION_REQUEST_KIND.FAMILY
  const title = isFamilyRequest ? 'Family device request' : 'Signature activation request'
  const body = isFamilyRequest
    ? `${requesterName} wants to add ${browser} (${operatingSystem}) as a family signing device. Tap to review.`
    : `${requesterName} is activating your signature on ${browser} (${operatingSystem}). Tap to review.`
  return {
    notification: { title, body },
    data: { kind: ACTIVATION_REQUEST_EVENT, requestId: String(requestId) },
    apns: {
      headers: buildApnsHeaders(`signature_${requestId}`),
      payload: { aps: { alert: { title, body }, sound: 'default' } },
    },
    android: { priority: 'high', notification: { channelId: 'urgent', sound: 'default' } },
  }
}

const notifyActivationRequest = async ({ owner, request }) => {
  try {
    const { dispatchUserWebSocketEvent } = require('#core/socket/socket.io')
    dispatchUserWebSocketEvent(owner.uniqueCode, ACTIVATION_REQUEST_EVENT, {
      kind: ACTIVATION_REQUEST_EVENT,
      requestId: String(request._id),
    })
    await dispatchMessageToUser(
      owner.uniqueCode,
      buildPushMessage({
        requestId: request._id,
        kind: request.kind,
        requesterName: owner.name,
        browser: request.browser,
        operatingSystem: request.operatingSystem,
      })
    )
  } catch (error) {
    logger.error('[signature.request.notification] notifyActivationRequest:', error)
  }
}

module.exports = { notifyActivationRequest }