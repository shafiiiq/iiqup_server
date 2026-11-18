const { resolveSignatureSource } = require('#core/signature/signature.registry')
const { resolveSlotOwners } = require('#core/signature/signature.slot.owner')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { YOUR_SIGNATURE_TURN_LINE, PLEASE_SIGN_SENTENCE } = require('./notification.constant')

const pickNextSlot = ({ sourceKey, document, activityType, signing }) => {
  if (activityType === DOCUMENT_ACTIVITY_TYPE.SIGNED) return signing.pendingSlots[0] || null
  const slots = resolveSignatureSource(sourceKey).getSlots(document)
  return [...slots].sort((firstSlot, secondSlot) => firstSlot.order - secondSlot.order)[0] || null
}

const resolveNextSigner = async ({ sourceKey, document, activityType, signing }) => {
  const slot = pickNextSlot({ sourceKey, document, activityType, signing })
  if (!slot) return { slot: null, ownerCodes: [], name: '' }
  const owners = await resolveSlotOwners(slot)
  return {
    slot,
    ownerCodes: owners.map((owner) => owner.uniqueCode),
    name: owners[0]?.name || slot.label,
  }
}

const buildRecipientBodies = ({ activityType, body, recipientCodes, nextSigner }) => {
  if (!nextSigner.slot) return {}
  const isSubmitted = activityType === DOCUMENT_ACTIVITY_TYPE.SUBMITTED
  return Object.fromEntries(
    recipientCodes.map((uniqueCode) => {
      const isTurn = nextSigner.ownerCodes.includes(uniqueCode)
      const header = isTurn ? YOUR_SIGNATURE_TURN_LINE : `${nextSigner.name} sign turn`
      const waitingSentence = `Waiting until ${nextSigner.name} signs, or override.`
      const suffix = isSubmitted ? ` ${isTurn ? PLEASE_SIGN_SENTENCE : waitingSentence}` : ''
      return [uniqueCode, `${header}\n${body}${suffix}`]
    })
  )
}

module.exports = { resolveNextSigner, buildRecipientBodies }