const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const deliveryReadService = require('#features/notification/notification.delivery.read.service');
const { acknowledgeDeliveries } = require('#features/notification/notification.delivery.queue.service');

const handleSyncRoute = (logTag, handler) => async (req, res) => {
  try {
    sendSuccess(res, await handler(req));
  } catch (error) {
    logger.error(`[sync.controller] ${logTag}`, error);
    sendError(res, { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message });
  }
};

const listQueue = handleSyncRoute('listQueue', async (req) => ({
  status: HTTP.OK,
  message: 'Queued deliveries retrieved',
  data: await deliveryReadService.listQueuedDeliveryPayloads(req.syncUniqueCode),
}));

const acknowledge = handleSyncRoute('acknowledge', async (req) => {
  await acknowledgeDeliveries({ uniqueCode: req.syncUniqueCode, pushIds: req.body.pushIds });
  return { status: HTTP.OK, message: 'Deliveries acknowledged', data: {} };
});

module.exports = { listQueue, acknowledge };