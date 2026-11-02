const webpush = require('web-push');
const User = require('#features/user/staff/staff.model');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const getSubscription = async (uniqueCode) => {
  const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
  return user?.webPushSubscription || null;
};

const clearSubscription = async (uniqueCode) => {
  await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: null } });
};

const sendPushNotification = async (subscription, payload, options = {}) => {
  await webpush.sendNotification(subscription, JSON.stringify(payload), options);
};

module.exports = {
  getSubscription,
  clearSubscription,
  sendPushNotification,
};