const mongoose = require('mongoose')

const fleetRecordActorSchema = new mongoose.Schema(
  {
    uniqueCode: { type: String, required: true },
    activityType: { type: String, required: true },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

module.exports = { fleetRecordActorSchema }