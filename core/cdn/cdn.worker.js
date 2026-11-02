const os = require('os')
const logger = require('#shared/logger/logger')
const VideoAsset = require('./cdn.asset.model')
const VideoJob = require('./cdn.job.model')
const {
  WORKER_CONCURRENCY,
  WORKER_POLL_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
} = require('./cdn.config')
const { claimNextJob, touchJobHeartbeat } = require('./cdn.queue')
const { completeJob, failJob } = require('./cdn.scheduler')
const {
  runSplitJob,
  runThumbnailJob,
  runLuminanceJob,
  runTranscodeJob,
  runCombineJob,
} = require('./cdn.job.handlers')
const { wait } = require('./cdn.utils')

let isRunning = false

const executeJob = async (asset, job) => {
  if (job.type === 'split') {
    await VideoAsset.updateOne({ _id: asset._id }, { $set: { status: 'splitting' } })
    return runSplitJob(asset)
  }
  if (job.type === 'thumbnail') return runThumbnailJob(asset)
  if (job.type === 'luminance') return runLuminanceJob(asset)
  if (job.type === 'transcode') return runTranscodeJob(asset, job)
  return runCombineJob(asset, job)
}

const processJob = async (job) => {
  const asset = await VideoAsset.findById(job.assetId)

  if (!asset || asset.status === 'failed') {
    await VideoJob.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', finishedAt: new Date(), error: 'Video asset unavailable' } }
    )
    return
  }

  const heartbeatTimer = setInterval(() => {
    touchJobHeartbeat(job._id).catch((error) =>
      logger.error('[cdn.worker] heartbeat failed:', error)
    )
  }, HEARTBEAT_INTERVAL_MS)

  try {
    const result = await executeJob(asset, job)
    await completeJob(job, result)
  } catch (error) {
    logger.error('[cdn.worker] job failed', {
      jobId: String(job._id),
      type: job.type,
      chunkIndex: job.chunkIndex,
      renditionName: job.renditionName,
      error: error.message,
    })
    await failJob(job, error.message || 'Job failed')
  } finally {
    clearInterval(heartbeatTimer)
  }
}

const runWorkerLoop = async (workerId) => {
  while (isRunning) {
    try {
      const job = await claimNextJob(workerId)
      if (!job) {
        await wait(WORKER_POLL_INTERVAL_MS)
        continue
      }
      await processJob(job)
    } catch (error) {
      logger.error('[cdn.worker] loop error:', error)
      await wait(WORKER_POLL_INTERVAL_MS)
    }
  }
}

const startWorkers = () => {
  if (isRunning) return
  isRunning = true
  for (let workerNumber = 1; workerNumber <= WORKER_CONCURRENCY; workerNumber += 1) {
    runWorkerLoop(`${os.hostname()}-${process.pid}-${workerNumber}`)
  }
  logger.info('[cdn.worker] started', { workerCount: WORKER_CONCURRENCY })
}

const stopWorkers = () => {
  isRunning = false
}

module.exports = {
  startWorkers,
  stopWorkers,
}