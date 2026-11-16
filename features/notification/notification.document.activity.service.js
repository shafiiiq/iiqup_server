const logger = require('#shared/logger/logger');
require('#core/document/document.activity.sources');
const { resolveDocumentActivitySource } = require('#core/document/document.activity.registry');
const { buildCreatedMessage, buildActivityMessage } = require('./notification.document.message');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');
const { buildDocumentActors, ensureDocumentActors } = require('#core/document/document.actor.service');
const Notification = require('./notification.model');
const { notifySafely } = require('./notification.dispatcher');
const { buildFeatureLinkFromDocument } = require('./notification.feature.service');
const { postSystemReply } = require('./notification.system.reply.service');
const { resolveCurrentPdfVersion } = require('./notification.feature.version');

const buildVersionedFeatureLink = async (sourceKey, document) => ({
  ...buildFeatureLinkFromDocument(sourceKey, document),
  pdfVersion: await resolveCurrentPdfVersion(sourceKey, document),
});

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false };

const announceDocumentCreated = async ({ sourceKey, document, actorUniqueCode }) => {
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

    const featureLink = await buildVersionedFeatureLink(sourceKey, document);
    return await notifySafely({
      actorUniqueCode,
      recipients: actors.map((actor) => actor.uniqueCode),
      title: `${featureLink.label} created`,
      body: buildCreatedMessage({ featureLink, partyName: definition.buildPartyName(document) }).body,
      source: { modelKey: featureLink.modelKey, documentId: String(document._id) },
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
  } catch (error) {
    logger.error(`[notification.document.activity] announceDocumentCreated failed: ${error.stack || error.message}`);
    return null;
  }
};

const announceDocumentActivity = async ({ sourceKey, document, actorUniqueCode, activityType, signing }) => {
  try {
    if (!actorUniqueCode) return null;
    const definition = resolveDocumentActivitySource(sourceKey);
    const featureLink = await buildVersionedFeatureLink(sourceKey, document);

    const actorCodes = await ensureDocumentActors({
      definition,
      document,
      codes: [actorUniqueCode, ...definition.buildParticipantCodes(document)],
    });

    const notification = await Notification.findOne({
      'source.modelKey': featureLink.modelKey,
      'source.documentId': String(document._id),
    })
      .select('_id')
      .lean();
    if (!notification) return null;

    const actor = await resolveActorByUniqueCode(actorUniqueCode);
    const message = buildActivityMessage({
      activityType,
      actorName: actor?.name || 'Someone',
      featureLink,
      partyName: definition.buildPartyName(document),
      signing,
    });

    return await postSystemReply({
      notificationId: notification._id,
      actorUniqueCode,
      text: message.activityBody,
      notifyCodes: actorCodes,
      pushTitle: actor?.name || 'Someone',
      pushBody: message.body,
      featureLinks: [featureLink],
    });
  } catch (error) {
    logger.error(`[notification.document.activity] announceDocumentActivity failed: ${error.stack || error.message}`);
    return null;
  }
};

module.exports = { announceDocumentCreated, announceDocumentActivity };