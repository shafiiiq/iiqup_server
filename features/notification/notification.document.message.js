const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')

const buildDocumentSubject = (featureLink) => `${featureLink.label} ${featureLink.reference}`

const buildCreatedMessage = (featureLink) => ({
  title: `${buildDocumentSubject(featureLink)} created`,
  body: 'Saved as draft. Signing is not allowed until it is sent for approval.',
})

const buildSignedText = (subject, signing) => {
  const signedPart = `signed ${subject} as ${signing.slotLabel}`
  const pendingLabels = signing.pendingSlotLabels
  if (pendingLabels.length === 0) return `${signedPart}. All signatures complete - approved.`
  if (pendingLabels.length === 1) return `${signedPart}. Next signature needed: ${pendingLabels[0]}.`
  return `${signedPart}. Pending signatures: ${pendingLabels.join(', ')}.`
}

const buildActivityText = ({ activityType, featureLink, signing }) => {
  const subject = buildDocumentSubject(featureLink)
  switch (activityType) {
    case DOCUMENT_ACTIVITY_TYPE.SUBMITTED:
      return `sent ${subject} for approval. Signing is now open.`
    case DOCUMENT_ACTIVITY_TYPE.SIGNED:
      return signing ? buildSignedText(subject, signing) : `signed ${subject}`
    case DOCUMENT_ACTIVITY_TYPE.AMENDED:
      return `amended ${subject}`
    case DOCUMENT_ACTIVITY_TYPE.EDITED:
      return `edited ${subject}`
    default:
      return `updated ${subject}`
  }
}

module.exports = { buildCreatedMessage, buildActivityText }