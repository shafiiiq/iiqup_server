const service = require('./webpush.service');

const subscribe = async (req, res) => {
  const { subscription, uniqueCode } = req.body;
  if (!subscription || !uniqueCode)
    return res.status(400).json({ success: false });

  await service.saveSubscription(uniqueCode, subscription);

  res.json({ success: true });
};

const send = async (req, res) => {
  const { uniqueCode, title, description } = req.body;

  const subscription = await service.getSubscription(uniqueCode);
  if (!subscription)
    return res.status(404).json({ success: false });

  try {
    await service.sendPushNotification(subscription, { title, description });
    res.json({ success: true });
  } catch (err) {
    if (err.statusCode === 410) {
      await service.clearSubscription(uniqueCode);
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { 
  subscribe,
  send 
};