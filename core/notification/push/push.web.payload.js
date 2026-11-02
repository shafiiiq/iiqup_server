const APPLE_PUSH_HOST = 'web.push.apple.com';
const DECLARATIVE_WEB_PUSH_MARKER = 8030;
const NOTIFICATION_ROUTE_PATH = '/notification';

const isAppleSubscription = (subscription) => {
  try {
    return new URL(subscription.endpoint).hostname.endsWith(APPLE_PUSH_HOST);
  } catch {
    return false;
  }
};

const buildNotificationNavigateUrl = (notificationId) => {
  const navigateUrl = new URL(NOTIFICATION_ROUTE_PATH, process.env.WEB_APP_BASE_URL);
  if (notificationId) navigateUrl.searchParams.set('notificationId', notificationId);
  return navigateUrl.toString();
};

const buildStandardWebPushPayload = (payload) => ({
  kind: payload.kind,
  notificationId: payload.notificationId,
  pushId: payload.pushId,
  title: payload.title,
  body: payload.body,
  priority: payload.priority,
  unreadCount: payload.unreadCount,
  totalUnread: payload.totalUnread,
  primaryAction: payload.primaryAction,
});

const buildDeclarativeWebPushPayload = (payload) => ({
  web_push: DECLARATIVE_WEB_PUSH_MARKER,
  notification: {
    title: payload.title || 'New Notification',
    body: payload.body || '',
    navigate: buildNotificationNavigateUrl(payload.notificationId), 
    app_badge: String(Number(payload.totalUnread) || 0),
  },
});

const buildWebPushPayloadForSubscription = (subscription, payload) =>
  isAppleSubscription(subscription) ? buildDeclarativeWebPushPayload(payload) : buildStandardWebPushPayload(payload);

module.exports = { buildWebPushPayloadForSubscription };