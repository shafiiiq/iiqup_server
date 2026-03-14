const express = require('express');
const router  = express.Router();
const webpush = require('web-push');
const User    = require('../models/user.model');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.post('/subscribe', async (req, res) => {
  const { subscription, uniqueCode } = req.body;
  if (!subscription || !uniqueCode) return res.status(400).json({ success: false });

  await User.findOneAndUpdate(
    { uniqueCode },
    { $set: { webPushSubscription: subscription } }
  );

  res.json({ success: true });
});

router.post('/send', async (req, res) => {
  const { uniqueCode, title, description } = req.body;

  const user = await User.findOne({ uniqueCode }).select('webPushSubscription');
  if (!user?.webPushSubscription) return res.status(404).json({ success: false });

  try {
    await webpush.sendNotification(
      user.webPushSubscription,
      JSON.stringify({ title, description })
    );
    res.json({ success: true });
  } catch (err) {
    if (err.statusCode === 410) {
      await User.findOneAndUpdate({ uniqueCode }, { $set: { webPushSubscription: null } });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;