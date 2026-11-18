const logger = require('#shared/logger/logger');
require('#core/document/document.activity.sources');
const { resolveDocumentActivitySource } = require('#core/document/document.activity.registry');
const { buildActivityMessage } = require('./notification.document.message');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { buildDocumentActors, ensureDocumentActors } = require('#core/document/document.actor.service');
const Notification = require('./notification.model');
const { notifySafely } = require('./notification.dispatcher');
const { buildFeatureLinkFromDocument } = require('./notification.feature.service');
const { postSystemReply } = require('./notification.system.reply.service');
const { resolveCurrentPdfVersion } = require('./notification.feature.version');
const { resolveNextSigner, buildRecipientBodies } = require('./notification.document.turn');
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant');

const buildVersionedFeatureLink = async (sourceKey, document) => ({
  ...buildFeatureLinkFromDocument(sourceKey, document),
  pdfVersion: await resolveCurrentPdfVersion(sourceKey, document),
});

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false };

const recordDocumentCreated = async ({ sourceKey, document, actorUniqueCode }) => {
  try {
    if (!actorUniqueCode) return null;
    const definition = resolveDocumentActivitySource(sourceKey);
    const actors = buildDocumentActors({
      ownerCode: actorUniqueCode,
      participantCodes: definition.buildParticipantCodes(document),
    });
    await definition.model.updateOne(
      { _id: document._id },
      { $set: { actors, viewedBy: [{ uniqueCode: actorUniqueCode, viewedAt: new Date() }] } },
      WITHOUT_TIMESTAMP_UPDATE
    );
    return actors;
  } catch (error) {
    logger.error(`[notification.document.activity] recordDocumentCreated failed: ${error.stack || error.message}`);
    return null;
  }
};

const announceDocumentActivity = async ({ sourceKey, document, actorUniqueCode, activityType, signing }) => {
  try {
    if (!actorUniqueCode) return null;
    const definition = resolveDocumentActivitySource(sourceKey);
    const featureLink = await buildVersionedFeatureLink(sourceKey, document);
    const nextSigner = await resolveNextSigner({ sourceKey, document, activityType, signing });
    const isAmendment = document.isAmendmented === true;

    const actorCodes = await ensureDocumentActors({
      definition,
      document,
      codes: [actorUniqueCode, ...definition.buildParticipantCodes(document), ...nextSigner.ownerCodes],
    });

    const actor = await resolveActorByUniqueCode(actorUniqueCode);
    const actorName = actor?.name || 'Someone';
    const message = buildActivityMessage({
      activityType,
      actorName,
      featureLink,
      partyName: definition.buildPartyName(document),
      signing,
      isAmendment,
      nextSignerName: nextSigner.name,
    });
    const pushBodyByUniqueCode = buildRecipientBodies({
      activityType,
      body: message.body,
      recipientCodes: actorCodes,
      nextSigner,
    });
    const pushTitle = isAmendment ? `${actorName} - Amendment` : actorName;
    const source = { modelKey: featureLink.modelKey, documentId: String(document._id) };

    const notification = await Notification.findOne({
      'source.modelKey': source.modelKey,
      'source.documentId': source.documentId,
    })
      .select('_id')
      .lean();

    if (!notification) {
      if (activityType !== DOCUMENT_ACTIVITY_TYPE.SUBMITTED) return null;
      return await notifySafely({
        actorUniqueCode,
        recipients: actorCodes,
        title: `${featureLink.label}${isAmendment ? ' amendment' : ''} sent for approval`,
        body: message.body,
        pushBodyByUniqueCode,
        source,
        actions: [
          {
            text: `Open ${featureLink.label}`,
            modelKey: featureLink.modelKey,
            documentId: featureLink.reference,
            screenKey: featureLink.screenKey,
          },
        ],
        featureLinks: [featureLink],
      });
    }

    return await postSystemReply({
      notificationId: notification._id,
      actorUniqueCode,
      text: message.activityBody,
      notifyCodes: actorCodes,
      pushTitle,
      pushBody: message.body,
      pushBodyByUniqueCode,
      featureLinks: [featureLink],
    });
  } catch (error) {
    logger.error(`[notification.document.activity] announceDocumentActivity failed: ${error.stack || error.message}`);
    return null;
  }
};

module.exports = { recordDocumentCreated, announceDocumentActivity };