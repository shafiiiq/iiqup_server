const nodeCrypto = require('crypto')
const { Types } = require('mongoose')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const Session = require('#core/session/session.model')
const SignatureActivationRequest = require('./signature.request.model')
const { verifyActivationCode, consumeActivationCode } = require('./signature.activation.service')
const {
  createDevice,
  verifyDeviceToken,
  isPrimaryDevice,
  assertFamilyAccessAvailable,
  revokeAllDevices,
} = require('./signature.device.service')
const { generateDeviceToken, sha256Hex } = require('./signature.crypto')
const { isValidDevicePublicKey } = require('./signature.proof')
const { parseUserAgent } = require('./signature.useragent')
const { notifyActivationRequest } = require('./signature.request.notification')
const {
  ACTIVATION_REQUEST_KIND,
  ACTIVATION_REQUEST_STATUS,
  ACTIVATION_REQUEST_VALID_MINUTES,
  ACTIVATION_REQUEST_RETENTION_HOURS,
  MAX_WRONG_NUMBER_ATTEMPTS,
  NUMBER_CHOICE_COUNT,
  MOBILE_PLATFORMS,
  DEVICE_PLATFORM,
  DEVICE_ROLE,
  SIGNATURE_ERROR_CODE,
} = require('./signature.constant')

const MATCH_NUMBER_MIN = 10
const MATCH_NUMBER_EXCLUSIVE_MAX = 100
const MILLISECONDS_PER_MINUTE = 60 * 1000
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE

const shuffle = (values) => {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const pickedIndex = nodeCrypto.randomInt(0, index + 1)
    const swappedValue = shuffled[index]
    shuffled[index] = shuffled[pickedIndex]
    shuffled[pickedIndex] = swappedValue
  }
  return shuffled
}

const buildNumberChoices = (matchNumber) => {
  const choices = new Set([matchNumber])
  while (choices.size < NUMBER_CHOICE_COUNT) {
    choices.add(nodeCrypto.randomInt(MATCH_NUMBER_MIN, MATCH_NUMBER_EXCLUSIVE_MAX))
  }
  return shuffle([...choices])
}

const isPollSecretValid = (storedHash, pollSecret) => {
  const expected = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(sha256Hex(String(pollSecret || '')), 'hex')
  return expected.length === actual.length && nodeCrypto.timingSafeEqual(expected, actual)
}

const expireIfStale = async (request) => {
  if (request.status === ACTIVATION_REQUEST_STATUS.PENDING && request.expiresAt < new Date()) {
    request.status = ACTIVATION_REQUEST_STATUS.EXPIRED
    await request.save()
  }
  return request
}

const loadOwnedRequest = async (requestId, userId) => {
  if (!Types.ObjectId.isValid(requestId)) throw new AppError('Invalid request id', HTTP.BAD_REQUEST)
  const request = await SignatureActivationRequest.findOne({ _id: requestId, userId })
  if (!request) throw new AppError('Activation request not found', HTTP.NOT_FOUND)
  return expireIfStale(request)
}

const loadOwnedRequestWithSecret = async ({ userId, requestId, pollSecret }) => {
  const request = await loadOwnedRequest(requestId, userId)
  if (!isPollSecretValid(request.pollSecretHash, pollSecret)) {
    throw new AppError('Invalid request credentials', HTTP.FORBIDDEN)
  }
  return request
}

const assertPending = (request) => {
  if (request.status !== ACTIVATION_REQUEST_STATUS.PENDING) {
    throw new AppError('This request is no longer pending', HTTP.CONFLICT)
  }
}

const serializeRequest = (request, owner) => ({
  requestId: request._id.toString(),
  kind: request.kind,
  status: request.status,
  createdAt: request.createdAt,
  expiresAt: request.expiresAt,
  numberChoices: request.numberChoices,
  requester: { name: owner?.name || '', email: owner?.email || '', role: owner?.role || '' },
  device: {
    label: request.deviceLabel,
    browser: request.browser,
    operatingSystem: request.operatingSystem,
    ipAddress: request.ipAddress,
    timezone: request.timezone,
  },
})

const expirePendingRequests = (userId) =>
  SignatureActivationRequest.updateMany(
    { userId, status: ACTIVATION_REQUEST_STATUS.PENDING },
    { $set: { status: ACTIVATION_REQUEST_STATUS.EXPIRED, resolvedAt: new Date() } }
  )

const assertOwnerHasMobileSession = async (userId) => {
  const mobileSessionCount = await Session.countDocuments({
    userId,
    isActive: true,
    'deviceInfo.platform': { $in: MOBILE_PLATFORMS },
  })
  if (mobileSessionCount === 0) {
    throw new AppError('No signed-in phone found. Log in on your phone first', HTTP.CONFLICT)
  }
}

const createActivationRequest = async ({
  userId,
  kind,
  platform,
  activationCode,
  publicKey,
  deviceLabel,
  ipAddress,
  userAgent,
  timezone,
}) => {
  const isFamilyRequest = kind === ACTIVATION_REQUEST_KIND.FAMILY
  const devicePlatform = platform === DEVICE_PLATFORM.MOBILE ? DEVICE_PLATFORM.MOBILE : DEVICE_PLATFORM.WEB
  if (devicePlatform === DEVICE_PLATFORM.MOBILE && !isFamilyRequest) {
    throw new AppError('Phones are activated directly with the activation code', HTTP.BAD_REQUEST)
  }
  if (devicePlatform === DEVICE_PLATFORM.WEB && !isValidDevicePublicKey(publicKey)) {
    throw new AppError('Invalid device key', HTTP.BAD_REQUEST, { code: SIGNATURE_ERROR_CODE.INVALID_PUBLIC_KEY })
  }
  if (isFamilyRequest) await assertFamilyAccessAvailable(userId)
  else await verifyActivationCode({ userId, activationCode })
  await assertOwnerHasMobileSession(userId)
  await expirePendingRequests(userId)

  const owner = await User.findById(userId).select('name email role uniqueCode').lean()
  const { browser, operatingSystem } = parseUserAgent(userAgent)
  const pollSecret = generateDeviceToken()
  const matchNumber = nodeCrypto.randomInt(MATCH_NUMBER_MIN, MATCH_NUMBER_EXCLUSIVE_MAX)
  const now = Date.now()

  const request = await SignatureActivationRequest.create({
    userId,
    matchNumber,
    numberChoices: buildNumberChoices(matchNumber),
    pollSecretHash: sha256Hex(pollSecret),
    kind: isFamilyRequest ? ACTIVATION_REQUEST_KIND.FAMILY : ACTIVATION_REQUEST_KIND.ACTIVATION,
    devicePlatform,
    publicKey: devicePlatform === DEVICE_PLATFORM.WEB ? publicKey : '',
    deviceLabel: String(deviceLabel || `${browser} on ${operatingSystem}`).slice(0, 100),
    browser,
    operatingSystem,
    ipAddress: String(ipAddress || ''),
    userAgent: String(userAgent || '').slice(0, 500),
    timezone: String(timezone || '').slice(0, 64),
    expiresAt: new Date(now + ACTIVATION_REQUEST_VALID_MINUTES * MILLISECONDS_PER_MINUTE),
    purgeAt: new Date(now + ACTIVATION_REQUEST_RETENTION_HOURS * MILLISECONDS_PER_HOUR),
  })

  await notifyActivationRequest({ owner, request })

  return { requestId: request._id.toString(), pollSecret, matchNumber, expiresAt: request.expiresAt }
}

const pollActivationRequest = async ({ userId, requestId, pollSecret }) => {
  const request = await loadOwnedRequestWithSecret({ userId, requestId, pollSecret })
  if (request.status !== ACTIVATION_REQUEST_STATUS.APPROVED) {
    return { status: request.status, expiresAt: request.expiresAt }
  }

  const claimed = await SignatureActivationRequest.findOneAndUpdate(
    { _id: request._id, status: ACTIVATION_REQUEST_STATUS.APPROVED },
    { $set: { status: ACTIVATION_REQUEST_STATUS.CLAIMED } }
  )
  if (!claimed) return { status: ACTIVATION_REQUEST_STATUS.CLAIMED }

  try {
    const isFamilyRequest = request.kind === ACTIVATION_REQUEST_KIND.FAMILY
    if (isFamilyRequest) await assertFamilyAccessAvailable(userId)
    const device = await createDevice({
      userId,
      label: request.deviceLabel,
      userAgent: request.userAgent,
      platform: request.devicePlatform,
      role: isFamilyRequest ? DEVICE_ROLE.FAMILY : DEVICE_ROLE.PRIMARY,
      publicKey: request.publicKey,
      ipAddress: request.ipAddress,
      timezone: request.timezone,
    })
    if (!isFamilyRequest) await revokeAllDevices(userId, device.deviceId)
    return { status: ACTIVATION_REQUEST_STATUS.APPROVED, ...device }
  } catch (error) {
    await SignatureActivationRequest.updateOne(
      { _id: request._id },
      { $set: { status: ACTIVATION_REQUEST_STATUS.APPROVED } }
    )
    throw error
  }
}

const cancelActivationRequest = async ({ userId, requestId, pollSecret }) => {
  const request = await loadOwnedRequestWithSecret({ userId, requestId, pollSecret })
  if (request.status === ACTIVATION_REQUEST_STATUS.PENDING) {
    request.status = ACTIVATION_REQUEST_STATUS.DENIED
    request.resolvedAt = new Date()
    await request.save()
  }
  return { status: request.status }
}

const getRequestForApprover = async ({ userId, requestId }) => {
  const request = await loadOwnedRequest(requestId, userId)
  const owner = await User.findById(userId).select('name email role').lean()
  return serializeRequest(request, owner)
}

const listPendingRequestsForApprover = async (userId) => {
  const [requests, owner] = await Promise.all([
    SignatureActivationRequest.find({
      userId,
      status: ACTIVATION_REQUEST_STATUS.PENDING,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }),
    User.findById(userId).select('name email role').lean(),
  ])
  return requests.map((request) => serializeRequest(request, owner))
}

const registerWrongNumber = async (request) => {
  request.wrongAttempts += 1
  if (request.wrongAttempts >= MAX_WRONG_NUMBER_ATTEMPTS) {
    request.status = ACTIVATION_REQUEST_STATUS.DENIED
    request.resolvedAt = new Date()
  }
  await request.save()
  throw new AppError('The number does not match', HTTP.FORBIDDEN, {
    code: SIGNATURE_ERROR_CODE.NUMBER_MISMATCH,
    isDenied: request.status === ACTIVATION_REQUEST_STATUS.DENIED,
  })
}

const assertPrimaryApprover = async ({ userId, approverDeviceToken }) => {
  const device = await verifyDeviceToken({ userId, deviceToken: approverDeviceToken })
  if (!device || !isPrimaryDevice(device)) {
    throw new AppError('Approve this request from your main signing phone', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.PRIMARY_DEVICE_REQUIRED,
    })
  }
}

const approveActivationRequest = async ({ userId, requestId, selectedNumber, approverDeviceToken }) => {
  const request = await loadOwnedRequest(requestId, userId)
  assertPending(request)
  if (request.kind === ACTIVATION_REQUEST_KIND.FAMILY) await assertPrimaryApprover({ userId, approverDeviceToken })
  if (Number(selectedNumber) !== request.matchNumber) await registerWrongNumber(request)

  const approved = await SignatureActivationRequest.findOneAndUpdate(
    { _id: request._id, status: ACTIVATION_REQUEST_STATUS.PENDING },
    { $set: { status: ACTIVATION_REQUEST_STATUS.APPROVED, resolvedAt: new Date() } }
  )
  if (!approved) throw new AppError('This request is no longer pending', HTTP.CONFLICT)

  try {
    if (request.kind !== ACTIVATION_REQUEST_KIND.FAMILY) await consumeActivationCode(userId)
  } catch (error) {
    await SignatureActivationRequest.updateOne(
      { _id: request._id },
      { $set: { status: ACTIVATION_REQUEST_STATUS.DENIED, resolvedAt: new Date() } }
    )
    throw error
  }

  return { requestId: request._id.toString(), status: ACTIVATION_REQUEST_STATUS.APPROVED }
}

const denyActivationRequest = async ({ userId, requestId }) => {
  const request = await loadOwnedRequest(requestId, userId)
  assertPending(request)
  request.status = ACTIVATION_REQUEST_STATUS.DENIED
  request.resolvedAt = new Date()
  await request.save()
  return { requestId: request._id.toString(), status: request.status }
}

module.exports = {
  createActivationRequest,
  pollActivationRequest,
  cancelActivationRequest,
  getRequestForApprover,
  listPendingRequestsForApprover,
  approveActivationRequest,
  denyActivationRequest,
  expirePendingRequests,
}