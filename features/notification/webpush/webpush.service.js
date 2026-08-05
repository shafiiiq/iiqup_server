const HTTP = require('../../../shared/constants/httpStatus.constant.js');
const webpush = require('web-push');
const User = require('../../user/user.model');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const saveSubscription = async (uniqueCode, subscription) => {
  await User.findOneAndUpdate(
    { uniqueCode },
    { $set: { webPushSubscription: subscription } }
  );
};

const getSubscription = async (uniqueCode) => {
  const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
  return user?.webPushSubscription || null;
};

const clearSubscription = async (uniqueCode) => {
  await User.findOneAndUpdate(
    { uniqueCode },
    { $set: { webPushSubscription: null } }
  );
};

const sendPushNotification = async (subscription, payload) => {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
};

module.exports = {
  saveSubscription,
  getSubscription,
  clearSubscription,
  sendPushNotification,
};