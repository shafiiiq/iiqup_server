const { TASK_WINDOW_DAYS } = require('./task.constant')

const DAY_MS = 24 * 60 * 60 * 1000

const startOfServerDay = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const resolveSince = (rawValue) => {
  const parsed = new Date(rawValue)
  return Number.isNaN(parsed.getTime()) ? startOfServerDay() : parsed
}

const buildWindowStart = () => new Date(Date.now() - TASK_WINDOW_DAYS * DAY_MS)

const buildTaskFilter = ({ since, incompleteFilter }) => ({
  updatedAt: { $gte: buildWindowStart() },
  $or: [{ updatedAt: { $gte: since } }, incompleteFilter],
})

module.exports = { resolveSince, buildTaskFilter }