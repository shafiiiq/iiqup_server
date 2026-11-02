const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const listService = require('./notification.list.service');
const countService = require('./notification.count.service');
const readService = require('./notification.read.service');
const likeService = require('./notification.like.service');
const { syncNotificationCounts } = require('./notification.dispatcher');
const { NOTIFICATION_TABS } = require('./notification.constant');

const toCountsResponse = (counts) => ({
  unreadCount: counts.unread,
  mentionsUnread: counts.mentionsUnread,
  repliesUnread: counts.repliesUnread,
});

const listNotifications = handleNotificationRoute('listNotifications', async (req) => {
  const { tab = NOTIFICATION_TABS.ALL, categoryKey, before, limit } = req.query;
  const result = await listService.listNotifications({
    uniqueCode: req.user.uniqueCode,
    tab,
    categoryKey,
    before,
    limit,
  });
  return { status: HTTP.OK, message: 'Notifications retrieved', data: result.items, pagination: result.pagination };
});

const listTabs = handleNotificationRoute('listTabs', async (req) => ({
  status: HTTP.OK,
  message: 'Tabs retrieved',
  data: await listService.listAvailableTabs(req.user.uniqueCode),
}));

const getCounts = handleNotificationRoute('getCounts', async (req) => ({
  status: HTTP.OK,
  message: 'Counts retrieved',
  data: await countService.getNotificationCounts(req.user.uniqueCode),
}));

const markRead = handleNotificationRoute('markRead', async (req) => {
  const { uniqueCode } = req.user;
  await readService.markNotificationRead({ notificationId: req.params.notificationId, uniqueCode });
  return { status: HTTP.OK, message: 'Marked as read', data: toCountsResponse(await syncNotificationCounts(uniqueCode)) };
});

const markAllRead = handleNotificationRoute('markAllRead', async (req) => {
  const { uniqueCode } = req.user;
  await readService.markAllNotificationsRead({ uniqueCode });
  return {
    status: HTTP.OK,
    message: 'Marked all as read',
    data: toCountsResponse(await syncNotificationCounts(uniqueCode)),
  };
});

const listViewers = handleNotificationRoute('listViewers', async (req) => ({
  status: HTTP.OK,
  message: 'Viewers retrieved',
  data: await readService.listNotificationViewers({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
  }),
}));

const setLike = handleNotificationRoute('setLike', async (req) => ({
  status: HTTP.OK,
  message: 'Like updated',
  data: await likeService.setNotificationLike({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
    isLiked: Boolean(req.body.isLiked),
  }),
}));

module.exports = { listNotifications, listTabs, getCounts, markRead, markAllRead, listViewers, setLike };