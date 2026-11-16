const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')

const buildDocumentTitle = ({ featureLink, partyName }) =>
  `${featureLink.label} ${featureLink.reference} for ${partyName}`

const buildCreatedMessage = ({ featureLink, partyName }) => {
  const title = buildDocumentTitle({ featureLink, partyName })
  return { title, body: `${title}\nDraft created. Wait until it is sent for approval.` }
}

const buildSignedBody = ({ actorName, signing }) => {
  const signedPart = `${actorName} signed as ${signing.slotLabel}.`
  if (signing.pendingSlotLabels.length === 0) return `${signedPart} All signatures complete. Approved.`
  return `${signedPart} Next to sign: ${signing.pendingSlotLabels[0]}.`
}

const buildActivityBody = ({ activityType, actorName, signing }) => {
  switch (activityType) {
    case DOCUMENT_ACTIVITY_TYPE.SUBMITTED:
      return `${actorName} sent it for approval. Signing is now open.`
    case DOCUMENT_ACTIVITY_TYPE.SIGNED:
      return buildSignedBody({ actorName, signing })
    case DOCUMENT_ACTIVITY_TYPE.AMENDED:
      return `${actorName} amended it.`
    case DOCUMENT_ACTIVITY_TYPE.EDITED:
      return `${actorName} edited it.`
    default:
      return `${actorName} updated it.`
  }
}

const buildActivityMessage = ({ activityType, actorName, featureLink, partyName, signing }) => {
  const title = buildDocumentTitle({ featureLink, partyName })
  const activityBody = buildActivityBody({ activityType, actorName, signing })
  return { title, activityBody, body: `${title}\n${activityBody}` }
}

module.exports = { buildCreatedMessage, buildActivityMessage }