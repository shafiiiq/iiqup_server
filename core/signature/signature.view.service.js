const { Types } = require('mongoose')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const SignatureEvent = require('./signature.event.model')
const SignatureAsset = require('./signature.asset.model')
const { resolveSignatureSource } = require('./signature.registry')
const { hashDocumentContent } = require('./signature.hash')
const { sha256Hex } = require('./signature.crypto')
const { loadSignatureImage } = require('./signature.storage')
const { loadViewerDelegationRoles } = require('./signature.delegation.service')
const { recordSignatureRead } = require('./signature.readlog.service')
const { resolveSlotOwners } = require('./signature.slot.owner')
const logger = require('#shared/logger/logger')

const assertCanView = (source, requester, document) => {
  if (!source.canViewDocument(requester, document)) {
    throw new AppError('You do not have access to this document', HTTP.FORBIDDEN)
  }
}

const getDocumentSignatures = async ({ sourceKey, documentId, requester }) => {
  const source = resolveSignatureSource(sourceKey)
  const document = await source.loadDocument(documentId)
  assertCanView(source, requester, document)

  const revision = source.getRevision(document)
  const slots = source.getSlots(document)
  const currentHash = hashDocumentContent(source.buildCanonicalContent(document))

  const events = await SignatureEvent.find({ sourceKey, documentId: String(documentId), documentRevision: revision }).lean()
  const signerIds = events.flatMap((event) => [event.userId, event.delegatedFromUserId].filter(Boolean))
  const [signers, viewer, delegationRoles, slotOwners] = await Promise.all([
    User.find({ _id: { $in: signerIds } }).select('name').lean(),
    User.findById(requester.id).select('role').lean(),
    loadViewerDelegationRoles(requester.id),
    Promise.all(slots.map((slot) => resolveSlotOwners(slot))),
  ])
  const assignedNameBySlotId = new Map(slots.map((slot, index) => [slot.slotId, slotOwners[index][0]?.name || '']))
  const signerNameById = new Map(signers.map((signer) => [String(signer._id), signer.name]))
  const eventBySlotId = new Map(events.map((event) => [event.slotId, event]))
  const viewerHasOwnSlot = Boolean(viewer) && slots.some((slot) => slot.allowedRoles.includes(viewer.role))

  const slotViews = slots
    .slice()
    .sort((first, second) => first.order - second.order)
    .map((slot) => {
      const event = eventBySlotId.get(slot.slotId)
      const isLegacySigned = !event && source.isLegacySigned(document, slot.slotId)
      const isSigned = Boolean(event) || isLegacySigned
      const isRoleAllowed = Boolean(viewer) && slot.allowedRoles.includes(viewer.role)
      const hasActiveDelegation = slot.allowedRoles.some((role) => delegationRoles.activeRoles.has(role))
      const hasPendingDelegation =
        !isSigned && slot.allowedRoles.some((role) => delegationRoles.pendingRoles.has(role))
      const ownerUserId = event && event.delegatedFromUserId ? event.delegatedFromUserId : event ? event.userId : null

      return {
        slotId: slot.slotId,
        label: slot.label,
        order: slot.order,
        isSigned,
        isLegacy: isLegacySigned,
        eventId: event ? event._id.toString() : null,
        signerName: ownerUserId ? signerNameById.get(String(ownerUserId)) || null : null,
        delegatedSignerName:
          event && event.delegatedFromUserId ? signerNameById.get(String(event.userId)) || null : null,
        signedAt: event ? event.signedAt : null,
        isContentIntact: event ? event.documentHash === currentHash : null,
        assignedName: assignedNameBySlotId.get(slot.slotId) || '',
        isMine: isRoleAllowed || hasActiveDelegation,
        signedByMe: Boolean(event) && String(event.userId) === String(requester.id),
        canSign: !isSigned && (isRoleAllowed || hasActiveDelegation),
        canRequestDelegation:
          !isSigned && Boolean(viewer) && !viewerHasOwnSlot && !hasActiveDelegation && !hasPendingDelegation,
        hasPendingDelegation,
      }
    })

  return { sourceKey, documentId: String(documentId), revision, slots: slotViews }
}

const getEventImageDataUrl = async ({ eventId, requester, ipAddress, userAgent }) => {
  if (!Types.ObjectId.isValid(eventId)) throw new AppError('Invalid event id', HTTP.BAD_REQUEST)

  const event = await SignatureEvent.findById(eventId).lean()
  if (!event) throw new AppError('Signature not found', HTTP.NOT_FOUND)

  const source = resolveSignatureSource(event.sourceKey)
  const document = await source.loadDocument(event.documentId)
  assertCanView(source, requester, document)

  const asset = await SignatureAsset.findById(event.assetId).select('s3Key').lean()
  if (!asset) throw new AppError('Signature image not found', HTTP.NOT_FOUND)

  const image = await loadSignatureImage(asset.s3Key)
  if (sha256Hex(image) !== event.imageSha256) {
    throw new AppError('Signature image integrity check failed', HTTP.INTERNAL_SERVER_ERROR)
  }

  await recordSignatureRead({ event, readerUserId: requester.id, ipAddress, userAgent }).catch((error) =>
    logger.error('[signature.view.service] recordSignatureRead:', error)
  )

  return { dataUrl: `data:image/png;base64,${image.toString('base64')}` }
}

module.exports = { getDocumentSignatures, getEventImageDataUrl }