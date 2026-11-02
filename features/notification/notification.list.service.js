const Notification = require('./notification.model');
const { paginateByCursor, clampLimit } = require('#shared/pagination/pagination.cursor');
const { buildTabQuery } = require('./notification.query.builder');
const { resolveSourceAttachments } = require('./notification.attachment.resolver');
const { serializeNotification } = require('./notification.serializer');
const { countUnseenRepliesByNotification } = require('./notification.reply.stats');
const { countUnreadNotifications, countUnreadMentions, countUnreadByCategory } = require('./notification.count.service');
const { resolveCategoryLabels } = require('./notification.category.service');
const { NOTIFICATION_LIST_LIMIT, NOTIFICATION_TABS } = require('./notification.constant');

const listNotifications = async ({ uniqueCode, tab, categoryKey, before, limit }) => {
  const query = await buildTabQuery({ uniqueCode, tab, categoryKey });
  const { items, pagination } = await paginateByCursor(Notification, query, {
    cursor: before,
    limit: clampLimit(limit, NOTIFICATION_LIST_LIMIT.DEFAULT, NOTIFICATION_LIST_LIMIT.MAX),
    sortField: 'lastActivityAt',
  });
  const [attachmentsBySource, unseenReplyCounts, categoryLabels] = await Promise.all([
    resolveSourceAttachments(items),
    countUnseenRepliesByNotification(
      items.map((notification) => notification._id),
      uniqueCode
    ),
    resolveCategoryLabels([...new Set(items.map((notification) => notification.categoryKey).filter(Boolean))]),
  ]);

  return {
    items: items.map((notification) =>
      serializeNotification(notification, uniqueCode, attachmentsBySource, unseenReplyCounts, categoryLabels)
    ),
    pagination,
  };
};

const listAvailableTabs = async (uniqueCode) => {
  const [categoryKeys, unread, mentionsUnread, unreadByCategory] = await Promise.all([
    Notification.distinct('categoryKey', { audience: uniqueCode, categoryKey: { $ne: null } }),
    countUnreadNotifications(uniqueCode),
    countUnreadMentions(uniqueCode),
    countUnreadByCategory(uniqueCode),
  ]);
  const labels = await resolveCategoryLabels(categoryKeys);

  const categoryTabs = categoryKeys
    .map((categoryKey) => ({
      id: `${NOTIFICATION_TABS.CATEGORY}:${categoryKey}`,
      tab: NOTIFICATION_TABS.CATEGORY,
      categoryKey,
      label: labels.get(categoryKey),
      pendingCount: unreadByCategory.get(categoryKey) || 0,
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  return [
    { id: NOTIFICATION_TABS.ALL, tab: NOTIFICATION_TABS.ALL, label: 'All', pendingCount: unread },
    { id: NOTIFICATION_TABS.UNREAD, tab: NOTIFICATION_TABS.UNREAD, label: 'Unread', pendingCount: unread },
    { id: NOTIFICATION_TABS.MENTIONS, tab: NOTIFICATION_TABS.MENTIONS, label: 'Mentions', pendingCount: mentionsUnread },
    ...categoryTabs,
  ];
};

module.exports = { listNotifications, listAvailableTabs };