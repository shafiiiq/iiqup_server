const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const replyService = require('./notification.reply.service');
const likeService = require('./notification.like.service');
const mentionService = require('./notification.mention.service');
const countService = require('./notification.count.service');

const listReplies = handleNotificationRoute('listReplies', async (req) => {
  const result = await replyService.listReplies({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
    after: req.query.after,
    limit: req.query.limit,
    aroundReplyId: req.query.around,
  });
  return { status: HTTP.OK, message: 'Replies retrieved', data: result.items, pagination: result.pagination };
});

const createReply = handleNotificationRoute('createReply', async (req) => {
  const { text, mentions, attachments, parentReplyId } = req.body;
  return {
    status: HTTP.CREATED,
    message: 'Reply created',
    data: await replyService.createReply({
      notificationId: req.params.notificationId,
      uniqueCode: req.user.uniqueCode,
      text,
      mentions,
      attachments,
      featureLinks: req.body.featureLinks,
      parentReplyId,
    }),
  };
});

const markRepliesViewed = handleNotificationRoute('markRepliesViewed', async (req) => {
  const { uniqueCode } = req.user;
  await replyService.markRepliesViewed({
    notificationId: req.params.notificationId,
    uniqueCode,
    replyIds: req.body.replyIds,
  });
  return {
    status: HTTP.OK,
    message: 'Replies marked as viewed',
    data: await countService.getNotificationCounts(uniqueCode),
  };
});

const setReplyLike = handleNotificationRoute('setReplyLike', async (req) => ({
  status: HTTP.OK,
  message: 'Like updated',
  data: await likeService.setReplyLike({
    replyId: req.params.replyId,
    uniqueCode: req.user.uniqueCode,
    isLiked: Boolean(req.body.isLiked),
  }),
}));

const searchMentionable = handleNotificationRoute('searchMentionable', async (req) => ({
  status: HTTP.OK,
  message: 'Mentionable users retrieved',
  data: await mentionService.searchMentionableActors({ term: req.query.q, uniqueCode: req.user.uniqueCode }),
}));

const listMentionTargets = handleNotificationRoute('listMentionTargets', async (req) => ({
  status: HTTP.OK,
  message: 'Mention targets retrieved',
  data: await mentionService.listUnreadMentionTargets(req.user.uniqueCode),
}));

module.exports = { listReplies, createReply, markRepliesViewed, setReplyLike, searchMentionable, listMentionTargets };