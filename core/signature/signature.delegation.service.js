const { Types } = require('mongoose')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const SignatureAsset = require('./signature.asset.model')
const SignatureEvent = require('./signature.event.model')
const SignatureDelegation = require('./signature.delegation.model')
const { resolveSignatureSource } = require('./signature.registry')
const { resolveSlotOwners } = require('./signature.slot.owner')
const { notifyDelegationRequest, notifyDelegationOutcome } = require('./signature.delegation.notification')
const { DELEGATION_STATUS, SIGNATURE_ERROR_CODE } = require('./signature.constant')

const buildPersonMap = async (userIds) => {
  const people = await User.find({ _id: { $in: userIds } }).select('name role uniqueCode').lean()
  return new Map(people.map((person) => [String(person._id), person]))
}

const serializeDelegation = (delegation, personById, personId) => {
  const person = personById.get(String(personId))
  return {
    delegationId: delegation._id.toString(),
    status: delegation.status,
    person: { name: person?.name || '', role: person?.role || '' },
    slotLabel: delegation.requestedSlotLabel,
    sourceKey: delegation.requestedSourceKey,
    documentId: delegation.requestedDocumentId,
    createdAt: delegation.createdAt,
    resolvedAt: delegation.resolvedAt,
  }
}

const listDelegations = async ({ filter, personField }) => {
  const delegations = await SignatureDelegation.find(filter).sort({ createdAt: -1 }).lean()
  const personById = await buildPersonMap(delegations.map((delegation) => delegation[personField]))
  return delegations.map((delegation) => serializeDelegation(delegation, personById, delegation[personField]))
}

const listDelegationRequests = (ownerId) =>
  listDelegations({ filter: { ownerUserId: ownerId, status: DELEGATION_STATUS.PENDING }, personField: 'delegateUserId' })

const listGivenDelegations = (ownerId) =>
  listDelegations({ filter: { ownerUserId: ownerId, status: DELEGATION_STATUS.ACTIVE }, personField: 'delegateUserId' })

const listReceivedDelegations = (delegateId) =>
  listDelegations({ filter: { delegateUserId: delegateId, status: DELEGATION_STATUS.ACTIVE }, personField: 'ownerUserId' })

const findActiveGrantForSlot = async ({ delegateUserId, slot }) => {
  const owners = await resolveSlotOwners(slot)
  if (owners.length === 0) return null
  return SignatureDelegation.findOne({
    delegateUserId,
    ownerUserId: { $in: owners.map((owner) => owner._id) },
    status: DELEGATION_STATUS.ACTIVE,
  }).lean()
}

const loadViewerDelegationRoles = async (userId) => {
  const delegations = await SignatureDelegation.find({
    delegateUserId: userId,
    status: { $in: [DELEGATION_STATUS.ACTIVE, DELEGATION_STATUS.PENDING] },
  })
    .select('ownerUserId status')
    .lean()
  const activeRoles = new Set()
  const pendingRoles = new Set()
  if (delegations.length === 0) return { activeRoles, pendingRoles }

  const personById = await buildPersonMap(delegations.map((delegation) => delegation.ownerUserId))
  delegations.forEach((delegation) => {
    const role = personById.get(String(delegation.ownerUserId))?.role
    if (!role) return
    if (delegation.status === DELEGATION_STATUS.ACTIVE) activeRoles.add(role)
    else pendingRoles.add(role)
  })
  return { activeRoles, pendingRoles }
}

const isSlotSigned = async ({ source, sourceKey, document, documentId, slotId }) => {
  const event = await SignatureEvent.exists({
    sourceKey,
    documentId,
    documentRevision: source.getRevision(document),
    slotId,
  })
  return Boolean(event) || source.isLegacySigned(document, slotId)
}

const requestDelegationForSlot = async ({ requester, sourceKey, documentId, slotId }) => {
  const source = resolveSignatureSource(sourceKey)
  const normalizedDocumentId = String(documentId)
  const document = await source.loadDocument(normalizedDocumentId)

  if (!source.canViewDocument(requester, document)) {
    throw new AppError('You do not have access to this document', HTTP.FORBIDDEN)
  }
  source.assertSignable(document)

  const slot = source.getSlots(document).find((candidate) => candidate.slotId === slotId)
  if (!slot) throw new AppError('Unknown signature position', HTTP.BAD_REQUEST)

  if (await isSlotSigned({ source, sourceKey, document, documentId: normalizedDocumentId, slotId })) {
    throw new AppError('This position has already been signed', HTTP.CONFLICT, {
      code: SIGNATURE_ERROR_CODE.ALREADY_SIGNED,
    })
  }

  const delegate = await User.findById(requester.id).select('name role uniqueCode isActive').lean()
  if (!delegate || !delegate.isActive) throw new AppError('Account is not active', HTTP.UNAUTHORIZED)
  const delegateHasOwnSlot = source.getSlots(document).some((candidate) => candidate.allowedRoles.includes(delegate.role))
  if (delegateHasOwnSlot) {
    throw new AppError('You already have a signing position on this document. Please sign your own position', HTTP.BAD_REQUEST)
  }
  if (!(await SignatureAsset.exists({ userId: delegate._id, isCurrent: true }))) {
    throw new AppError('No signature is registered for your account', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.SIGNATURE_NOT_REGISTERED,
    })
  }

  const [owner] = await resolveSlotOwners(slot)
  if (!owner) throw new AppError('No owner found for this position', HTTP.NOT_FOUND)

  const existing = await SignatureDelegation.findOne({
    ownerUserId: owner._id,
    delegateUserId: delegate._id,
    status: { $in: [DELEGATION_STATUS.ACTIVE, DELEGATION_STATUS.PENDING] },
  }).lean()
  if (existing) return { delegationId: existing._id.toString(), status: existing.status }

  const delegation = await SignatureDelegation.create({
    ownerUserId: owner._id,
    delegateUserId: delegate._id,
    requestedSourceKey: sourceKey,
    requestedDocumentId: normalizedDocumentId,
    requestedSlotId: slot.slotId,
    requestedSlotLabel: slot.label,
  })
  await notifyDelegationRequest({ owner, delegate, delegation, slotLabel: slot.label })

  return { delegationId: delegation._id.toString(), status: DELEGATION_STATUS.PENDING }
}

const resolveOwnedDelegation = async ({ ownerId, delegationId, fromStatus, toStatus, timestampField }) => {
  if (!Types.ObjectId.isValid(delegationId)) throw new AppError('Invalid delegation id', HTTP.BAD_REQUEST)
  const updated = await SignatureDelegation.findOneAndUpdate(
    { _id: delegationId, ownerUserId: ownerId, status: fromStatus },
    { $set: { status: toStatus, [timestampField]: new Date() } },
    { new: true }
  ).lean()
  if (!updated) throw new AppError('Delegation not found or already resolved', HTTP.NOT_FOUND)
  return updated
}

const notifyDelegate = async ({ delegation, buildMessage }) => {
  const [owner, delegate] = await Promise.all([
    User.findById(delegation.ownerUserId).select('name uniqueCode').lean(),
    User.findById(delegation.delegateUserId).select('uniqueCode').lean(),
  ])
  if (!owner || !delegate) return
  const { title, body } = buildMessage(owner.name)
  await notifyDelegationOutcome({
    actorUniqueCode: owner.uniqueCode,
    recipientUniqueCode: delegate.uniqueCode,
    title,
    body,
  })
}

const approveDelegation = async ({ ownerId, delegationId }) => {
  const delegation = await resolveOwnedDelegation({
    ownerId,
    delegationId,
    fromStatus: DELEGATION_STATUS.PENDING,
    toStatus: DELEGATION_STATUS.ACTIVE,
    timestampField: 'resolvedAt',
  })
  await notifyDelegate({
    delegation,
    buildMessage: (ownerName) => ({
      title: `${ownerName} approved your signing request`,
      body: `You can now sign the ${delegation.requestedSlotLabel} position with your own signature. ${ownerName} can revoke this at any time.`,
    }),
  })
  return { delegationId, status: DELEGATION_STATUS.ACTIVE }
}

const denyDelegation = async ({ ownerId, delegationId }) => {
  const delegation = await resolveOwnedDelegation({
    ownerId,
    delegationId,
    fromStatus: DELEGATION_STATUS.PENDING,
    toStatus: DELEGATION_STATUS.DENIED,
    timestampField: 'resolvedAt',
  })
  await notifyDelegate({
    delegation,
    buildMessage: (ownerName) => ({
      title: `${ownerName} denied your signing request`,
      body: `Your request to sign the ${delegation.requestedSlotLabel} position was not approved.`,
    }),
  })
  return { delegationId, status: DELEGATION_STATUS.DENIED }
}

const revokeDelegation = async ({ ownerId, delegationId }) => {
  const delegation = await resolveOwnedDelegation({
    ownerId,
    delegationId,
    fromStatus: DELEGATION_STATUS.ACTIVE,
    toStatus: DELEGATION_STATUS.REVOKED,
    timestampField: 'revokedAt',
  })
  await notifyDelegate({
    delegation,
    buildMessage: (ownerName) => ({
      title: `${ownerName} revoked your signing permission`,
      body: `You can no longer sign the ${delegation.requestedSlotLabel} position on their behalf.`,
    }),
  })
  return { delegationId, status: DELEGATION_STATUS.REVOKED }
}

const notifyOwnerOfDelegatedSigning = async ({ delegation, signer, slot, documentId }) => {
  const owner = await User.findById(delegation.ownerUserId).select('uniqueCode').lean()
  if (!owner) return
  await notifyDelegationOutcome({
    actorUniqueCode: signer.uniqueCode,
    recipientUniqueCode: owner.uniqueCode,
    title: `${signer.name} signed the ${slot.label} position for you`,
    body: `${documentId} was signed with ${signer.name}'s own signature under your approved permission.`,
  })
}

module.exports = {
  listDelegationRequests,
  listGivenDelegations,
  listReceivedDelegations,
  findActiveGrantForSlot,
  loadViewerDelegationRoles,
  requestDelegationForSlot,
  approveDelegation,
  denyDelegation,
  revokeDelegation,
  notifyOwnerOfDelegatedSigning,
}