const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { isRegisteredModelKey, findScreenDefinition } = require('#core/registry/model.registry');
const Notification = require('./notification.model');
const { resolveActorByUniqueCode, resolveActorsByUniqueCodes } = require('./notification.actor.resolver');
const { getCategoryMemberCodes, registerCategoryParticipants } = require('./notification.category.members.service');
const { NOTIFICATION_PRIORITIES, DEFAULT_PRIORITY } = require('./notification.constant');

const APP_PLATFORMS = ['app', 'both'];

const toUniqueCodes = (values = []) => [
  ...new Set(values.filter((value) => typeof value === 'string' && value.trim())),
];

const assertValidSource = (source) => {
  if (!source) return;
  if (!isRegisteredModelKey(source.modelKey) || !source.documentId) {
    throw new AppError('source requires a registered modelKey and a documentId', HTTP.BAD_REQUEST);
  }
};

const assertValidActions = (actions) => {
  actions.forEach((action) => {
    const screen = findScreenDefinition(action.modelKey, action.screenKey);
    const isValid = action.text && action.documentId && screen && APP_PLATFORMS.includes(screen.platform);
    if (!isValid) throw new AppError(`Invalid action "${action.text || ''}"`, HTTP.BAD_REQUEST);
  });
};

const createNotification = async ({
  actorUniqueCode = null,
  recipients,
  title,
  body = '',
  priority = DEFAULT_PRIORITY,
  source = null,
  actions = [],
  mentions = [],
  categoryKey = null,
  attachments = [],
  featureLinks = [],
}) => {
  if (!title) throw new AppError('title is required', HTTP.BAD_REQUEST);
  assertValidSource(source);
  assertValidActions(actions);

  const mentionedActors = await resolveActorsByUniqueCodes(toUniqueCodes(mentions));
  const mentionCodes = mentionedActors
    .map((mentionedActor) => mentionedActor.uniqueCode)
    .filter((uniqueCode) => uniqueCode !== actorUniqueCode);

  const resolvedCategoryKey = categoryKey || source?.modelKey || null;
  const categoryMemberCodes = resolvedCategoryKey ? await getCategoryMemberCodes(resolvedCategoryKey) : [];

  const recipientCodes = toUniqueCodes([...toUniqueCodes(recipients), ...mentionCodes, ...categoryMemberCodes]).filter(
    (uniqueCode) => uniqueCode !== actorUniqueCode
  );
  if (recipientCodes.length === 0) return null;

  const actor = actorUniqueCode ? await resolveActorByUniqueCode(actorUniqueCode) : null;
  const audience = toUniqueCodes([...recipientCodes, actorUniqueCode]);
  if (resolvedCategoryKey) await registerCategoryParticipants(resolvedCategoryKey, audience);

  const notification = await Notification.create({
    title,
    body,
    priority: NOTIFICATION_PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY,
    actor,
    source,
    actions,
    categoryKey: categoryKey || source?.modelKey || null,
    attachments,
    featureLinks,
    audience,
    recipients: recipientCodes,
    mentions: mentionCodes,
  });

  return notification.toObject();
};

module.exports = { createNotification, toUniqueCodes };