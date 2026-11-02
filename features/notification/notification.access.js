const mongoose = require('mongoose');
const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const Notification = require('./notification.model');

const assertValidObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${label}`, HTTP.BAD_REQUEST);
};

const findVisibleNotification = async (notificationId, uniqueCode, projection = null) => {
  assertValidObjectId(notificationId, 'notification id');
  const notification = await Notification.findOne({ _id: notificationId, audience: uniqueCode }, projection).lean();
  if (!notification) throw new AppError('Notification not found', HTTP.NOT_FOUND);
  return notification;
};

module.exports = { assertValidObjectId, findVisibleNotification };