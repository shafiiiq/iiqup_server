const mongoose = require('mongoose')
const { resolveParticipantModel } = require('./dashboard.participants.registry')

const MAX_PARTICIPANT_REFERENCES = 50

const buildParticipantKey = (collection, id) => `${collection}:${id}`

const readActorCodes = (record) => [
  ...new Set((record.actors || []).map((actor) => actor.uniqueCode).filter(Boolean)),
]

const isValidReference = (reference) =>
  Boolean(reference?.collection) && mongoose.Types.ObjectId.isValid(reference?.id)

const groupReferencesByModel = (references) => {
  const groups = new Map()

  references
    .slice(0, MAX_PARTICIPANT_REFERENCES)
    .filter(isValidReference)
    .forEach((reference) => {
      const model = resolveParticipantModel(reference.collection)
      if (!model) return
      const group = groups.get(model) ?? []
      group.push(reference)
      groups.set(model, group)
    })

  return groups
}

module.exports = { buildParticipantKey, readActorCodes, groupReferencesByModel }