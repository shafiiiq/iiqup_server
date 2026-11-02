const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { resolveActorByUniqueCode, resolveActorsByUniqueCodes } = require('./notification.actor.resolver');
const { toUniqueCodes } = require('./notification.create.service');
const { notify } = require('./notification.dispatcher');
const { ensureCategory } = require('./notification.category.service');
const { normalizeAttachmentInputs } = require('./notification.attachment.input');
const { resolveFeatureLinks } = require('./notification.feature.service');
const { MAX_REPLY_TEXT_LENGTH } = require('./notification.constant');

const composeMessage = async ({ uniqueCode, text, mentions, categoryLabel, attachments, featureLinks }) => {
  const trimmedText = String(text || '').trim();
  const messageAttachments = normalizeAttachmentInputs(attachments);
  const links = await resolveFeatureLinks(featureLinks);

  if (!trimmedText && messageAttachments.length === 0 && links.length === 0) {
    throw new AppError('Message cannot be empty', HTTP.BAD_REQUEST);
  }
  if (trimmedText.length > MAX_REPLY_TEXT_LENGTH) throw new AppError('Message is too long', HTTP.BAD_REQUEST);

  const author = await resolveActorByUniqueCode(uniqueCode);
  if (!author) throw new AppError('Author not found', HTTP.FORBIDDEN);

  const mentionedActors = await resolveActorsByUniqueCodes(toUniqueCodes(mentions));
  const mentionCodes = mentionedActors.map((actor) => actor.uniqueCode).filter((code) => code !== uniqueCode);
  const category = categoryLabel ? await ensureCategory({ label: categoryLabel, uniqueCode }) : null;

  const notification = await notify({
    actorUniqueCode: uniqueCode,
    recipients: mentionCodes,
    mentions: mentionCodes,
    title: category ? `${author.name} posted in ${category.label}` : `${author.name} sent a message`,
    body: trimmedText || links.map((link) => link.title).join(', '),
    categoryKey: category ? category.key : null,
    attachments: messageAttachments,
    featureLinks: links,
  });
  if (!notification) throw new AppError('Mention at least one person', HTTP.BAD_REQUEST);

  return { notificationId: String(notification._id) };
};

module.exports = { composeMessage };