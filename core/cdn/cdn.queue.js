const VideoJob = require('./cdn.job.model')

const claimNextJob = (workerId) => {
  const now = new Date()
  return VideoJob.findOneAndUpdate(
    { status: 'waiting' },
    {
      $set: { status: 'running', workerId, startedAt: now, heartbeatAt: now },
      $inc: { attempts: 1 },
    },
    { sort: { priority: -1, createdAt: 1 }, new: true }
  )
}

const touchJobHeartbeat = (jobId) =>
  VideoJob.updateOne({ _id: jobId, status: 'running' }, { $set: { heartbeatAt: new Date() } })

module.exports = {
  claimNextJob,
  touchJobHeartbeat,
}