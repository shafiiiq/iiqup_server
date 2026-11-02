const mongoose = require('mongoose');

const notificationCategorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    createdBy: { type: String, default: '' },
    usageCount: { type: Number, default: 0 },
    members: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationCategory', notificationCategorySchema);