const mongoose = require('mongoose');
const { DOCUMENT_ACTOR_ROLE } = require('./document.activity.constant');

const documentActorSchema = new mongoose.Schema(
  {
    uniqueCode: { type: String, required: true },
    role: { type: String, enum: Object.values(DOCUMENT_ACTOR_ROLE), default: DOCUMENT_ACTOR_ROLE.PARTICIPANT },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const documentViewSchema = new mongoose.Schema(
  { uniqueCode: { type: String, required: true }, viewedAt: { type: Date, default: Date.now } },
  { _id: false }
);

module.exports = { documentActorSchema, documentViewSchema };