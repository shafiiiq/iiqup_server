const mongoose = require('mongoose');
const { ACTOR_MODEL_NAMES } = require('./notification.constant');

const actorSchema = new mongoose.Schema(
  {
    model: { type: String, enum: ACTOR_MODEL_NAMES, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    uniqueCode: { type: String, required: true },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    profilePicPath: { type: String, default: '' },
  },
  { _id: false }
);

const readReceiptSchema = new mongoose.Schema(
  { uniqueCode: { type: String, required: true }, readAt: { type: Date, default: Date.now } },
  { _id: false }
);

const likeSchema = new mongoose.Schema(
  { uniqueCode: { type: String, required: true }, likedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const viewReceiptSchema = new mongoose.Schema(
  { uniqueCode: { type: String, required: true }, viewedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    filePath: { type: String, required: true },
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
  },
  { _id: false }
);

module.exports = {
  actorSchema,
  readReceiptSchema,
  likeSchema,
  viewReceiptSchema,
  attachmentSchema,
};