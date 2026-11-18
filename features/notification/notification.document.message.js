const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')

const AMENDMENT_TITLE_SUFFIX = ' (Amendment)'

const buildDocumentTitle = ({ featureLink, partyName, isAmendment }) =>
  `${featureLink.label} ${featureLink.reference} for ${partyName}${isAmendment ? AMENDMENT_TITLE_SUFFIX : ''}`

const buildSubmittedBody = ({ actorName, isAmendment }) =>
  isAmendment ? `${actorName} sent the amendment for approval.` : `${actorName} sent it for approval.`

const buildSignedBody = ({ actorName, signing, isAmendment, nextSignerName }) => {
  const signedPart = `${actorName} signed ${isAmendment ? 'the amendment ' : ''}as ${signing.slotLabel}.`
  return `${signedPart} Next to sign: ${signing.pendingSlots[0].label} (${nextSignerName}).`
}

const buildApprovedBody = ({ actorName, featureLink, partyName, isAmendment }) =>
  `${actorName} approved ${featureLink.label.toLowerCase()}${isAmendment ? ' amendment' : ''} ${featureLink.reference}, for ${partyName}`

const buildActivityBody = ({ activityType, actorName, signing, isAmendment, nextSignerName }) => {
  switch (activityType) {
    case DOCUMENT_ACTIVITY_TYPE.SUBMITTED:
      return buildSubmittedBody({ actorName, isAmendment })
    case DOCUMENT_ACTIVITY_TYPE.SIGNED:
      return buildSignedBody({ actorName, signing, isAmendment, nextSignerName })
    default:
      throw new Error(`Unsupported document notification type: ${activityType}`)
  }
}

const buildActivityMessage = ({
  activityType,
  actorName,
  featureLink,
  partyName,
  signing,
  isAmendment,
  nextSignerName,
}) => {
  const isApproval = activityType === DOCUMENT_ACTIVITY_TYPE.SIGNED && signing.pendingSlots.length === 0
  if (isApproval) {
    const approvedBody = buildApprovedBody({ actorName, featureLink, partyName, isAmendment })
    return { title: approvedBody, activityBody: approvedBody, body: approvedBody }
  }

  const title = buildDocumentTitle({ featureLink, partyName, isAmendment })
  const activityBody = buildActivityBody({ activityType, actorName, signing, isAmendment, nextSignerName })
  return { title, activityBody, body: `${title}\n${activityBody}` }
}

module.exports = { buildActivityMessage }