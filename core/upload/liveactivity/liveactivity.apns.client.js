const http2 = require('http2')
const { APNS_HOST, APNS_BUNDLE_ID, PUSH_PRIORITY, REQUEST_TIMEOUT_MS, REJECTED_TOKEN_REASONS } = require('./liveactivity.config')
const { getProviderToken, resetProviderToken } = require('./liveactivity.provider.token')

let clientSession = null

const getClientSession = () => {
  if (clientSession && !clientSession.closed && !clientSession.destroyed) return clientSession
  const newSession = http2.connect(APNS_HOST)
  newSession.on('error', () => {
    clientSession = null
  })
  newSession.on('close', () => {
    clientSession = null
  })
  clientSession = newSession
  return newSession
}

const parseRejectionReason = (responseBody) => {
  try {
    return JSON.parse(responseBody).reason
  } catch {
    return undefined
  }
}

const sendLiveActivityPush = ({ pushToken, payload }) =>
  new Promise((resolve, reject) => {
    const request = getClientSession().request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      authorization: `bearer ${getProviderToken()}`,
      'apns-push-type': 'liveactivity',
      'apns-topic': `${APNS_BUNDLE_ID}.push-type.liveactivity`,
      'apns-priority': String(PUSH_PRIORITY),
      'content-type': 'application/json',
    })

    let statusCode = 0
    let responseBody = ''

    request.setEncoding('utf8')
    request.on('response', (headers) => {
      statusCode = headers[':status']
    })
    request.on('data', (chunk) => {
      responseBody += chunk
    })
    request.on('end', () => {
      const reason = parseRejectionReason(responseBody)
      if (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken') resetProviderToken()
      resolve({ statusCode, reason })
    })
    request.on('error', reject)
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.close(http2.constants.NGHTTP2_CANCEL)
      reject(new Error('APNs request timed out'))
    })
    request.end(JSON.stringify(payload))
  })

const isPushTokenRejected = (result) =>
  result.statusCode === 410 || REJECTED_TOKEN_REASONS.includes(result.reason)

module.exports = {
  sendLiveActivityPush,
  isPushTokenRejected,
}