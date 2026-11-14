const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const User = require('../staff/staff.model')
const Mechanic = require('../mechanic/mechanic.model')
const Operator = require('../operator/operator.model')
const { buildDirectoryFilter } = require('./directory.helper')

const DIRECTORY_FIELDS = 'name email uniqueCode userType'

const fetchDirectoryUsers = async (search, limit) => {
  try {
    const filter = buildDirectoryFilter(search?.trim())

    const groups = await Promise.all(
      [User, Mechanic, Operator].map((Model) => Model.find(filter).select(DIRECTORY_FIELDS).limit(limit).lean())
    )

    const users = groups
      .flat()
      .sort((first, second) => (first.name || '').localeCompare(second.name || ''))
      .slice(0, limit)

    return { status: HTTP.OK, message: 'Directory fetched successfully', data: users }
  } catch (error) {
    logger.error('[directory.service] fetchDirectoryUsers', error)
    throw { status: HTTP.INTERNAL_SERVER_ERROR, message: error.message || 'Failed to fetch directory' }
  }
}

module.exports = { fetchDirectoryUsers }