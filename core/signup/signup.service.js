const crypto = require('crypto')
const mongoose = require('mongoose')
const HTTP = require('#shared/response/response.status')
const { AppError } = require('#shared/errors/error.http')
const { AUTH_MAIL_PATTERN } = require('#core/authN/authN.constants')
const { createAccount, hashPassword, findExistingAccount } = require('#core/account/account.factory')
const { verifySocialToken } = require('#core/oauth/oauth.link.token')
const { createLink, findLinkByIdentity } = require('#core/oauth/oauth.link.store')
const { SOCIAL_LINK_PURPOSE } = require('#core/oauth/oauth.constant')
const SignupRequest = require('./signup.model')
const { generatePendingApprovalCode } = require('./signup.code')
const { notifyAdminsOfSignupRequest, broadcastSignupRequestChange } = require('./signup.notify')
const { emitSignupStatus } = require('./signup.socket')
const {
  SIGNUP_STATUS,
  ACCOUNT_TYPES,
  PENDING_TTL_MS,
  RESOLVED_TTL_MS,
  MIN_SIGNUP_PASSWORD_LENGTH,
} = require('./signup.constant')

const toTicket = (request) => ({
  requestId: request._id,
  approvalCode: request.approvalCode,
  expiresAt: request.expiresAt,
})

const toAdminListItem = (request) => ({
  id: request._id,
  accountType: request.accountType,
  identity: request.email || request.qatarId,
  socialProvider: request.socialProvider || null,
  approvalCode: request.approvalCode,
  createdAt: request.createdAt,
})

const requireQatarId = (qatarId) => {
  const normalizedQatarId = String(qatarId || '').trim()
  if (!normalizedQatarId) throw new AppError('Qatar ID is required', HTTP.BAD_REQUEST)
  return normalizedQatarId
}

const requireFullName = (fullName) => {
  const normalizedFullName = String(fullName || '').trim()
  if (!normalizedFullName) throw new AppError('Full name is required', HTTP.BAD_REQUEST)
  return normalizedFullName
}

const buildSocialDraft = async ({ accountType, fullName, qatarId, linkToken }) => {
  const claims = verifySocialToken(SOCIAL_LINK_PURPOSE, linkToken)

  if (await findLinkByIdentity(claims.provider, claims.subject)) {
    throw new AppError('This social account is already linked to an account', HTTP.CONFLICT)
  }

  const socialDetails = {
    accountType,
    name: requireFullName(fullName),
    socialProvider: claims.provider,
    socialSubject: claims.subject,
  }

  if (accountType === 'staff') {
    if (!claims.email) throw new AppError('Your social account does not share an email address', HTTP.BAD_REQUEST)
    return {
      ...socialDetails,
      email: claims.email.toLowerCase(),
      passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
    }
  }

  return { ...socialDetails, qatarId: requireQatarId(qatarId) }
}

const buildDirectDraft = async ({ accountType, fullName, qatarId, email, password }) => {
  const name = requireFullName(fullName)

  if (accountType !== 'staff') return { accountType, name, qatarId: requireQatarId(qatarId) }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!AUTH_MAIL_PATTERN.test(normalizedEmail)) throw new AppError('Please enter a valid email address', HTTP.BAD_REQUEST)
  if (String(password || '').length < MIN_SIGNUP_PASSWORD_LENGTH) {
    throw new AppError(`Password must be at least ${MIN_SIGNUP_PASSWORD_LENGTH} characters`, HTTP.BAD_REQUEST)
  }
  return {
    accountType,
    name,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
  }
}

const createSignupRequest = async (body) => {
  if (!ACCOUNT_TYPES.includes(body.accountType)) throw new AppError('Invalid account type', HTTP.BAD_REQUEST)

  const draft = body.linkToken ? await buildSocialDraft(body) : await buildDirectDraft(body)

  if (await findExistingAccount(draft)) {
    throw new AppError('An account already exists. Please sign in or link your existing account.', HTTP.CONFLICT)
  }

  const identityFilter = draft.accountType === 'staff' ? { email: draft.email } : { qatarId: draft.qatarId }
  const pendingRequest = await SignupRequest.findOne({
    ...identityFilter,
    accountType: draft.accountType,
    status: SIGNUP_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  })
  if (pendingRequest) {
    return { status: HTTP.OK, success: true, message: 'Request already pending', data: toTicket(pendingRequest) }
  }

  const request = await SignupRequest.create({
    ...draft,
    approvalCode: await generatePendingApprovalCode(),
    expiresAt: new Date(Date.now() + PENDING_TTL_MS),
  })
  notifyAdminsOfSignupRequest(request)
  broadcastSignupRequestChange()

  return { status: HTTP.CREATED, success: true, message: 'Request submitted', data: toTicket(request) }
}

const getSignupRequestStatus = async (requestId) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return { status: HTTP.OK, success: true, data: { status: 'expired' } }
  }
  const request = await SignupRequest.findById(requestId).select('status').lean()
  return { status: HTTP.OK, success: true, data: { status: request ? request.status : 'expired' } }
}

const listPendingSignupRequests = async () => {
  const requests = await SignupRequest.find({
    status: SIGNUP_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .lean()

  return { status: HTTP.OK, success: true, data: { requests: requests.map(toAdminListItem) } }
}

const findPendingRequestForResolution = async (requestId) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) throw new AppError('Request not found', HTTP.NOT_FOUND)
  const request = await SignupRequest.findOne({ _id: requestId, status: SIGNUP_STATUS.PENDING }).select('+passwordHash')
  if (!request) throw new AppError('Request not found or already resolved', HTTP.NOT_FOUND)
  return request
}

const markRequestResolved = async (request, status, adminId) => {
  request.status = status
  request.resolvedBy = adminId
  request.expiresAt = new Date(Date.now() + RESOLVED_TTL_MS)
  await request.save()
  emitSignupStatus(request._id, status)
  broadcastSignupRequestChange()
}

const approveSignupRequest = async (requestId, adminId) => {
  const request = await findPendingRequestForResolution(requestId)

  const account = await createAccount({
    accountType: request.accountType,
    name: request.name,
    email: request.email,
    passwordHash: request.passwordHash,
    qatarId: request.qatarId,
  })

  if (request.socialProvider) {
    await createLink({
      provider: request.socialProvider,
      subject: request.socialSubject,
      accountType: request.accountType,
      accountId: account._id,
      email: request.email,
    })
  }

  await markRequestResolved(request, SIGNUP_STATUS.APPROVED, adminId)
  return { status: HTTP.OK, success: true, message: 'Request approved' }
}

const rejectSignupRequest = async (requestId, adminId) => {
  const request = await findPendingRequestForResolution(requestId)
  await markRequestResolved(request, SIGNUP_STATUS.REJECTED, adminId)
  return { status: HTTP.OK, success: true, message: 'Request rejected' }
}

module.exports = {
  createSignupRequest,
  getSignupRequestStatus,
  listPendingSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
}