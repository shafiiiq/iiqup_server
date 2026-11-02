const mongoose = require('mongoose');
const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');
const { getReplySummary } = require('./notification.reply.stats');
const { handleNotificationRoute } = require('./notification.route.handler');

const getSummary = handleNotificationRoute('getReplySummary', async (req) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid notification id', HTTP.BAD_REQUEST);

  const isVisible = await Notification.exists({ _id: id, audience: req.user.uniqueCode });
  if (!isVisible) throw new AppError('Notification not found', HTTP.NOT_FOUND);

  return {
    status: HTTP.OK,
    message: 'Reply summary retrieved',
    data: await getReplySummary(id, req.user.uniqueCode),
  };
});

module.exports = { getReplySummary: getSummary };