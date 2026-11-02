const NotificationReply = require('./notification.reply.model');

const SNIPPET_LENGTH = 90;

const buildSnippet = (reply) => {
  if (reply.text) return reply.text.slice(0, SNIPPET_LENGTH);
  if ((reply.attachments || []).some((attachment) => attachment.mimeType?.startsWith('audio/'))) return 'Voice message';
  if ((reply.featureLinks || []).length > 0) return reply.featureLinks[0].label;
  return 'Attachment';
};

const withParentPreviews = async (serializedReplies) => {
  const parentIds = [
    ...new Set(serializedReplies.map((reply) => reply.parentReplyId).filter(Boolean).map(String)),
  ];
  if (parentIds.length === 0) return serializedReplies.map((reply) => ({ ...reply, parentPreview: null }));

  const parents = await NotificationReply.find({ _id: { $in: parentIds } })
    .select('author text attachments featureLinks')
    .lean();
  const previewById = new Map(
    parents.map((parent) => [
      String(parent._id),
      { replyId: String(parent._id), authorName: parent.author?.name || '', text: buildSnippet(parent) },
    ])
  );

  return serializedReplies.map((reply) => ({
    ...reply,
    parentPreview: reply.parentReplyId ? previewById.get(String(reply.parentReplyId)) || null : null,
  }));
};

module.exports = { withParentPreviews };