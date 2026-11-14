const VideoJob = require('./cdn.job.model')

const calculateElapsedMs = (startedAt) =>
  startedAt ? Math.max(0, Date.now() - new Date(startedAt).getTime()) : 0

const sumDoneJobDurationMs = async (assetId, type, renditionName) => {
  const [result] = await VideoJob.aggregate([
    { $match: { assetId, type, renditionName, status: 'done' } },
    { $group: { _id: null, totalMs: { $sum: '$durationMs' } } },
  ])
  return result ? result.totalMs : 0
}

module.exports = {
  calculateElapsedMs,
  sumDoneJobDurationMs,
}