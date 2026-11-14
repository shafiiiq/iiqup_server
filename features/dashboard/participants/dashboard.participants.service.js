const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')
const { buildParticipantKey, readActorCodes, groupReferencesByModel } = require('./dashboard.participants.helper')

const PROFILE_FIELDS = 'name uniqueCode profilePic.filePath'

const fetchProfilesByCode = async (uniqueCodes) => {
  if (!uniqueCodes.length) return new Map()

  const groups = await Promise.all(
    [User, Mechanic, Operator].map((Model) =>
      Model.find({ uniqueCode: { $in: uniqueCodes } }).select(PROFILE_FIELDS).lean()
    )
  )

  return new Map(
    groups.flat().map((profile) => [
      profile.uniqueCode,
      {
        uniqueCode: profile.uniqueCode,
        name: profile.name || '',
        profilePicPath: profile.profilePic?.filePath || null,
      },
    ])
  )
}

const fetchActorCodesByKey = async (references) => {
  const actorCodesByKey = new Map()
  const groups = groupReferencesByModel(references)

  await Promise.all(
    [...groups].map(async ([model, groupReferences]) => {
      const records = await model
        .find({ _id: { $in: groupReferences.map((reference) => reference.id) } })
        .select('actors')
        .lean()
      const recordById = new Map(records.map((record) => [String(record._id), record]))

      groupReferences.forEach((reference) => {
        const record = recordById.get(String(reference.id))
        if (record) actorCodesByKey.set(buildParticipantKey(reference.collection, reference.id), readActorCodes(record))
      })
    })
  )

  return actorCodesByKey
}

const fetchRecentParticipants = async (references) => {
  try {
    const actorCodesByKey = await fetchActorCodesByKey(references)
    const allCodes = [...new Set([...actorCodesByKey.values()].flat())]
    const profileByCode = await fetchProfilesByCode(allCodes)

    const participantsByKey = Object.fromEntries(
      [...actorCodesByKey].map(([key, codes]) => [key, codes.map((code) => profileByCode.get(code)).filter(Boolean)])
    )

    return { status: HTTP.OK, message: 'Participants fetched successfully', data: participantsByKey }
  } catch (error) {
    logger.error('[dashboard.participants.service] fetchRecentParticipants', error)
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Failed to fetch participants' }
  }
}

module.exports = { fetchRecentParticipants }