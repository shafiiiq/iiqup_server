const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const editService = require('./notification.edit.service');
const deleteService = require('./notification.delete.service');

const editNotification = handleNotificationRoute('editNotification', async (req) => ({
  status: HTTP.OK,
  message: 'Message updated',
  data: await editService.editNotificationText({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
    text: req.body.text,
  }),
}));

const deleteNotification = handleNotificationRoute('deleteNotification', async (req) => ({
  status: HTTP.OK,
  message: 'Message deleted',
  data: await deleteService.deleteNotification({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
  }),
}));

const restoreNotification = handleNotificationRoute('restoreNotification', async (req) => ({
  status: HTTP.OK,
  message: 'Message restored',
  data: await deleteService.restoreNotification({
    notificationId: req.params.notificationId,
    uniqueCode: req.user.uniqueCode,
  }),
}));

const editReply = handleNotificationRoute('editReply', async (req) => ({
  status: HTTP.OK,
  message: 'Reply updated',
  data: await editService.editReplyText({
    replyId: req.params.replyId,
    uniqueCode: req.user.uniqueCode,
    text: req.body.text,
  }),
}));

const deleteReply = handleNotificationRoute('deleteReply', async (req) => ({
  status: HTTP.OK,
  message: 'Reply deleted',
  data: await deleteService.deleteReply({ replyId: req.params.replyId, uniqueCode: req.user.uniqueCode }),
}));

const restoreReply = handleNotificationRoute('restoreReply', async (req) => ({
  status: HTTP.OK,
  message: 'Reply restored',
  data: await deleteService.restoreReply({ replyId: req.params.replyId, uniqueCode: req.user.uniqueCode }),
}));

module.exports = {
  editNotification,
  deleteNotification,
  restoreNotification,
  editReply,
  deleteReply,
  restoreReply,
};