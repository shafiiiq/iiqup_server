const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const receiptService = require('./notification.receipt.service');

const getNotificationReceipts = handleNotificationRoute('getNotificationReceipts', async (req) => ({
  status: HTTP.OK,
  message: 'Receipts retrieved',
  data: await receiptService.getNotificationReceiptDetails({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
  }),
}));

const getReplyReceipts = handleNotificationRoute('getReplyReceipts', async (req) => ({
  status: HTTP.OK,
  message: 'Receipts retrieved',
  data: await receiptService.getReplyReceiptDetails({
    replyId: req.params.replyId,
    uniqueCode: req.user.uniqueCode,
  }),
}));

module.exports = { getNotificationReceipts, getReplyReceipts };