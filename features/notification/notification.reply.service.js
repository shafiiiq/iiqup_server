const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { paginateByCursor, clampLimit } = require('#shared/pagination/pagination.cursor');
const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { assertValidObjectId, findVisibleNotification } = require('./notification.access');
const { resolveActorByUniqueCode, resolveActorsByUniqueCodes } = require('./notification.actor.resolver');
const { toUniqueCodes } = require('./notification.create.service');
const { recordNotificationActivity } = require('./notification.activity.service');
const { serializeReply } = require('./notification.serializer');
const { normalizeAttachmentInputs } = require('./notification.attachment.input');
const { resolveFeatureLinks } = require('./notification.feature.service');
const {
  findPendingComplaintForNotification,
  completeComplaintFromReply,
} = require('#features/fleet/complaint/complaint.rectification');
const {
  COMPLAINT_RECTIFY_TOKEN_PATTERN,
  COMPLAINT_RECTIFY_DEFAULT_TEXT,
} = require('#features/fleet/complaint/complaint.constant');
const { withParentPreviews } = require('./notification.reply.preview');
const {
  REPLY_LIST_LIMIT,
  REPLIES_AFTER_MENTION,
  REPLY_WINDOW_LIMIT,
  MAX_REPLY_TEXT_LENGTH,
  PUSH_BODY_PREVIEW_LENGTH,
} = require('./notification.constant');

const normalizeAttachments = normalizeAttachmentInputs;

const buildPreview = (reply) => {
  if (reply.text) return reply.text.slice(0, PUSH_BODY_PREVIEW_LENGTH);
  if (reply.featureLinks?.length) return reply.featureLinks[0].title;
  if (reply.attachments.some((attachment) => attachment.mimeType.startsWith('audio/'))) return 'Sent a voice message';
  return reply.attachments.length ? 'Sent an attachment' : '';
};

const resolveParentReplyAuthorCode = async (parentReplyId, notificationId) => {
  if (!parentReplyId) return null;
  assertValidObjectId(parentReplyId, 'parent reply id');
  const parentReply = await NotificationReply.findOne({ _id: parentReplyId, notificationId }).select('author').lean();
  if (!parentReply) throw new AppError('Parent reply not found', HTTP.NOT_FOUND);
  return parentReply.author.uniqueCode;
};

const notifyReplyParticipants = async ({ reply, author, parent, mentionCodes, parentReplyAuthorCode }) => {
  const preview = buildPreview(reply);
  const previousParticipantCodes = await NotificationReply.distinct('author.uniqueCode', {
    notificationId: parent._id,
  });
  const replyRecipients = toUniqueCodes([
    parent.actor?.uniqueCode,
    parentReplyAuthorCode,
    ...(parent.recipients || []),
    ...previousParticipantCodes,
  ]).filter((uniqueCode) => !mentionCodes.includes(uniqueCode));

  if (mentionCodes.length > 0) {
    await recordNotificationActivity({
      notificationId: parent._id,
      actorUniqueCode: author.uniqueCode,
      notifyCodes: mentionCodes,
      title: `${author.name} mentioned you`,
      body: preview,
      activityType: 'mention',
      replyId: reply._id,
    });
  }
  await recordNotificationActivity({
    notificationId: parent._id,
    actorUniqueCode: author.uniqueCode,
    notifyCodes: replyRecipients,
    title: `${author.name} replied`,
    body: preview,
    activityType: 'reply',
    replyId: reply._id,
  });
};

const createReply = async ({ notificationId, featureLinks, uniqueCode, text = '', mentions = [], attachments = [], parentReplyId = null }) => {
  const links = await resolveFeatureLinks(featureLinks);
  const isRectifyRequested = COMPLAINT_RECTIFY_TOKEN_PATTERN.test(String(text));
  const cleanedText = String(text).replace(COMPLAINT_RECTIFY_TOKEN_PATTERN, '$1').trim();
  const trimmedText = cleanedText || (isRectifyRequested ? COMPLAINT_RECTIFY_DEFAULT_TEXT : '');
  const replyAttachments = normalizeAttachments(attachments);
  if (!trimmedText && replyAttachments.length === 0) throw new AppError('Reply cannot be empty', HTTP.BAD_REQUEST);
  if (trimmedText.length > MAX_REPLY_TEXT_LENGTH) throw new AppError('Reply is too long', HTTP.BAD_REQUEST);

  const parent = await findVisibleNotification(notificationId, uniqueCode);
  const author = await resolveActorByUniqueCode(uniqueCode);
  if (!author) throw new AppError('Author not found', HTTP.FORBIDDEN);

  const rectifiedComplaint = isRectifyRequested ? await findPendingComplaintForNotification(parent) : null;

  const parentReplyAuthorCode = await resolveParentReplyAuthorCode(parentReplyId, notificationId);
  const mentionedActors = await resolveActorsByUniqueCodes(toUniqueCodes(mentions));
  const mentionCodes = mentionedActors.map((actor) => actor.uniqueCode).filter((code) => code !== uniqueCode);

  const created = await NotificationReply.create({
    notificationId,
    author,
    text: trimmedText,
    mentions: mentionCodes,
    attachments: replyAttachments,
    featureLinks: links,
    parentReplyId,
    viewedBy: [{ uniqueCode }],
  });
  const reply = created.toObject();

  await Notification.updateOne({ _id: notificationId }, { $inc: { replyCount: 1 } });
  if (rectifiedComplaint) {
    await completeComplaintFromReply({
      complaint: rectifiedComplaint,
      remarks: cleanedText,
      attachments: replyAttachments,
      mechanicName: author.name,
    });
  }
  await notifyReplyParticipants({ reply, author, parent, mentionCodes, parentReplyAuthorCode });

  const serializedReply = serializeReply(reply, uniqueCode);
  const [withPreview] = await withParentPreviews([serializedReply]);

  return withPreview;
};

const countRepliesUpTo = (notificationId, targetReply) =>
  NotificationReply.countDocuments({
    notificationId,
    $or: [
      { createdAt: { $lt: targetReply.createdAt } },
      { createdAt: targetReply.createdAt, _id: { $lte: targetReply._id } },
    ],
  });

const resolveReplyPageLimit = async ({ notificationId, limit, after, aroundReplyId }) => {
  const requestedLimit = clampLimit(limit, REPLY_LIST_LIMIT.DEFAULT, REPLY_LIST_LIMIT.MAX);
  if (!aroundReplyId || after) return requestedLimit;

  assertValidObjectId(aroundReplyId, 'reply id');
  const targetReply = await NotificationReply.findOne({ _id: aroundReplyId, notificationId })
    .select('createdAt')
    .lean();
  if (!targetReply) return requestedLimit;

  const repliesThroughTarget = await countRepliesUpTo(notificationId, targetReply);
  return Math.min(repliesThroughTarget + REPLIES_AFTER_MENTION, REPLY_WINDOW_LIMIT);
};

const listReplies = async ({ notificationId, uniqueCode, after, limit, aroundReplyId }) => {
  await findVisibleNotification(notificationId, uniqueCode, '_id');
  const pageLimit = await resolveReplyPageLimit({ notificationId, limit, after, aroundReplyId });

  const { items, pagination } = await paginateByCursor(
    NotificationReply,
    { notificationId },
    { cursor: after, direction: 'asc', limit: pageLimit }
  );
  return { items: await withParentPreviews(items), pagination };
};

const markRepliesViewed = async ({ notificationId, uniqueCode, replyIds = [] }) => {
  await findVisibleNotification(notificationId, uniqueCode, '_id');
  if (!Array.isArray(replyIds) || replyIds.length === 0) return;
  replyIds.forEach((replyId) => assertValidObjectId(replyId, 'reply id'));

  await NotificationReply.updateMany(
    { notificationId, _id: { $in: replyIds }, 'viewedBy.uniqueCode': { $ne: uniqueCode } },
    { $push: { viewedBy: { uniqueCode, viewedAt: new Date() } } }
  );
};

module.exports = { createReply, listReplies, markRepliesViewed };