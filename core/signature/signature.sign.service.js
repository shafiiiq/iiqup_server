const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const SignatureAsset = require('./signature.asset.model')
const SignatureEvent = require('./signature.event.model')
const { resolveSignatureSource } = require('./signature.registry')
const { hashDocumentContent } = require('./signature.hash')
const { verifyDeviceToken } = require('./signature.device.service')
const { assertDeviceProof } = require('./signature.challenge.service')
const { SIGNATURE_ERROR_CODE } = require('./signature.constant')
const { findActiveGrantForSlot, notifyOwnerOfDelegatedSigning } = require('./signature.delegation.service')

const DUPLICATE_KEY_ERROR_CODE = 11000

const buildAlreadySignedError = () =>
  new AppError('This position has already been signed', HTTP.CONFLICT, { code: SIGNATURE_ERROR_CODE.ALREADY_SIGNED })

const loadActiveSigner = async (requesterId) => {
  const signer = await User.findById(requesterId).select('name email role uniqueCode userType isActive').lean()
  if (!signer || !signer.isActive) throw new AppError('Account is not active', HTTP.UNAUTHORIZED)
  return signer
}

const resolveSigningDelegation = async ({ signer, slot }) => {
  if (slot.allowedRoles.includes(signer.role)) return null
  const delegation = await findActiveGrantForSlot({ delegateUserId: signer._id, slot })
  if (!delegation) {
    throw new AppError('You are not allowed to sign this position', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.ROLE_NOT_ALLOWED,
    })
  }
  return delegation
}

const assertSignerEligibility = async ({ signer, slot, deviceToken }) => {
  const delegation = await resolveSigningDelegation({ signer, slot })

  const asset = await SignatureAsset.findOne({ userId: signer._id, isCurrent: true }).lean()
  if (!asset) {
    throw new AppError('No signature is registered for your account', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.SIGNATURE_NOT_REGISTERED,
    })
  }

  const device = await verifyDeviceToken({ userId: signer._id, deviceToken })
  if (!device) {
    throw new AppError('This device is not activated for signing', HTTP.FORBIDDEN, {
      code: SIGNATURE_ERROR_CODE.DEVICE_NOT_ACTIVATED,
    })
  }

  return { asset, device, delegation }
}

const signDocument = async ({
  requester,
  deviceToken,
  challengeId,
  proof,
  sourceKey,
  documentId,
  slotId,
  override,
  ipAddress,
  userAgent,
}) => {
  const source = resolveSignatureSource(sourceKey)
  const normalizedDocumentId = String(documentId)
  const document = await source.loadDocument(normalizedDocumentId)

  if (!source.canViewDocument(requester, document)) {
    throw new AppError('You do not have access to this document', HTTP.FORBIDDEN)
  }
  source.assertSignable(document)

  const slots = source.getSlots(document)
  const slot = slots.find((candidate) => candidate.slotId === slotId)
  if (!slot) throw new AppError('Unknown signature position', HTTP.BAD_REQUEST)

  const signer = await loadActiveSigner(requester.id)
  const { asset, device, delegation } = await assertSignerEligibility({ signer, slot, deviceToken })
  await assertDeviceProof({ device, challengeId, proof, sourceKey, documentId: normalizedDocumentId, slotId })

  const revision = source.getRevision(document)
  const existingEvents = await SignatureEvent.find({
    sourceKey,
    documentId: normalizedDocumentId,
    documentRevision: revision,
  })
    .select('slotId')
    .lean()
  const signedSlotIds = new Set(existingEvents.map((event) => event.slotId))
  const isSlotSigned = (candidateSlotId) => signedSlotIds.has(candidateSlotId) || source.isLegacySigned(document, candidateSlotId)

  if (isSlotSigned(slot.slotId)) throw buildAlreadySignedError()

  const unsignedPredecessors = slots.filter((candidate) => candidate.order < slot.order && !isSlotSigned(candidate.slotId))
  if (unsignedPredecessors.length > 0 && !override) {
    return {
      status: HTTP.ACCEPTED_OVERRIDE_REQUIRED,
      requireOverride: true,
      message: 'Earlier positions have not signed yet. Confirm override to proceed.',
      unsignedPositions: unsignedPredecessors.map((candidate) => candidate.label),
    }
  }

  const wasOverride = unsignedPredecessors.length > 0
  let event
  try {
    event = await SignatureEvent.create({
      sourceKey,
      documentId: normalizedDocumentId,
      documentRevision: revision,
      slotId: slot.slotId,
      userId: signer._id,
      assetId: asset._id,
      imageSha256: asset.imageSha256,
      documentHash: hashDocumentContent(source.buildCanonicalContent(document)),
      deviceId: device._id,
      delegatedFromUserId: delegation ? delegation.ownerUserId : null,
      delegationId: delegation ? delegation._id : null,
      wasOverride,
      ipAddress,
      userAgent,
    })
  } catch (error) {
    if (error.code === DUPLICATE_KEY_ERROR_CODE) throw buildAlreadySignedError()
    throw error
  }

  try {
    await source.onSigned({ document, slot, signer, event: event.toObject(), wasOverride, ipAddress, userAgent })
  } catch (error) {
    await SignatureEvent.deleteOne({ _id: event._id })
    throw error
  }

  if (delegation) await notifyOwnerOfDelegatedSigning({ delegation, signer, slot, documentId: normalizedDocumentId })

  return {
    status: HTTP.OK,
    message: `${slot.label} signature recorded successfully`,
    data: { slotId: slot.slotId, eventId: event._id.toString(), signedAt: event.signedAt },
  }
}

module.exports = { signDocument }