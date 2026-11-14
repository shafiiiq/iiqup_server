const logger = require('#shared/logger/logger')

const appendFleetRecordActors = async ({ model, recordIds, actorUniqueCode, activityType }) => {
  if (!actorUniqueCode || !recordIds.length) return

  try {
    await model.updateMany(
      { _id: { $in: recordIds } },
      { $push: { actors: { uniqueCode: actorUniqueCode, activityType, occurredAt: new Date() } } }
    )
  } catch (error) {
    logger.error('[fleet.record.actor.service] appendFleetRecordActors', error)
  }
}

module.exports = { appendFleetRecordActors }