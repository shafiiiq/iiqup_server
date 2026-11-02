const PQueue = require('p-queue').default
const { JOB_QUEUE_CONCURRENCY } = require('./queue.constant')

const jobQueue = new PQueue({ concurrency: JOB_QUEUE_CONCURRENCY })
const inFlightJobs = new Map()

const enqueueJob = (jobKey, task) => {
  const existingJob = inFlightJobs.get(jobKey)
  if (existingJob) return existingJob

  const job = jobQueue.add(task).finally(() => inFlightJobs.delete(jobKey))
  inFlightJobs.set(jobKey, job)
  return job
}

module.exports = { enqueueJob }