const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const deliveryReadService = require('./notification.delivery.read.service');
const { acknowledgeDeliveries } = require('./notification.delivery.queue.service');

const listPending = handleNotificationRoute('listPendingNotifications', async (req) => ({
  status: HTTP.OK,
  message: 'Pending notifications retrieved',
  data: await deliveryReadService.listQueuedDeliveryPayloads(req.user.uniqueCode),
}));

const markDelivered = handleNotificationRoute('markNotificationsDelivered', async (req) => {
  await acknowledgeDeliveries({
    uniqueCode: req.user.uniqueCode,
    pushIds: req.body.pushIds,
  });
  return { status: HTTP.OK, message: 'Marked as delivered', data: {} };
});

module.exports = { listPending, markDelivered };