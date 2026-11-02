const mongoose = require('mongoose');

const notificationDeliverySequenceSchema = new mongoose.Schema({
  uniqueCode: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
  wakeLockUntil: { type: Date, default: null },
});

module.exports = mongoose.model('NotificationDeliverySequence', notificationDeliverySequenceSchema);