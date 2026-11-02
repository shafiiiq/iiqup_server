const logger = require('#shared/logger/logger')
const VideoAsset = require('./cdn.asset.model')
const VideoJob = require('./cdn.job.model')
const {
  RENDITIONS,
  SPLIT_JOB_PRIORITY,
  THUMBNAIL_JOB_PRIORITY,
  THUMBNAIL_CONTENT_TYPE,
  LUMINANCE_JOB_PRIORITY,
  COMBINE_JOB_PRIORITY_BONUS,
  MAX_JOB_ATTEMPTS,
  STALE_JOB_TIMEOUT_MS,
  SCHEDULER_INTERVAL_MS,
  PLAYLIST_CONTENT_TYPE,
  getRenditionByName,
  selectRenditionsForSource,
} = require('./cdn.config')
const { buildMasterPlaylistKey } = require('./cdn.keys')
const { uploadTextToObject } = require('./cdn.storage')
const { isDuplicateKeyError } = require('./cdn.utils')

let schedulerTimer = null
let isTickRunning = false

const createJobs = async (jobs) => {
  if (jobs.length === 0) return
  try {
    await VideoJob.insertMany(jobs, { ordered: false })
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
  }
}

const enqueueSplitJob = (assetId) =>
  createJobs([
    {
      assetId,
      type: 'split',
      chunkIndex: -1,
      renditionName: '',
      priority: SPLIT_JOB_PRIORITY,
    },
  ])

const buildMasterPlaylist = (renditions) => {
  const sortedRenditions = renditions.slice().sort((first, second) => first.height - second.height)
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7']

  sortedRenditions.forEach((rendition) => {
    const renditionConfig = getRenditionByName(rendition.name)
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${renditionConfig.bandwidth},NAME="${rendition.name}"`)
    lines.push(`renditions/${rendition.name}/index.m3u8`)
  })

  return `${lines.join('\n')}\n`
}

const finalizeAssetIfReady = async (assetId) => {
  const asset = await VideoAsset.findById(assetId)
  if (!asset || asset.status === 'ready' || asset.status === 'failed') return
  if (asset.renditions.length === 0) return
  if (!asset.renditions.every((rendition) => rendition.status === 'ready')) return

  const masterKey = buildMasterPlaylistKey(assetId)
  await uploadTextToObject(masterKey, buildMasterPlaylist(asset.renditions), PLAYLIST_CONTENT_TYPE)
  await VideoAsset.updateOne(
    { _id: assetId },
    { $set: { status: 'ready', masterKey, completedAt: new Date() } }
  )

  logger.info('[cdn.scheduler] video asset ready', { assetId })
}

const advanceRendition = async (assetId, renditionName) => {
  const asset = await VideoAsset.findById(assetId)
  if (!asset || asset.status === 'failed') return

  const rendition = asset.renditions.find((candidate) => candidate.name === renditionName)
  if (!rendition || rendition.status !== 'waiting') return

  const doneTranscodeJobs = await VideoJob.countDocuments({
    assetId,
    type: 'transcode',
    renditionName,
    status: 'done',
  })
  if (doneTranscodeJobs < asset.chunkCount) return

  const renditionConfig = getRenditionByName(renditionName)

  await createJobs([
    {
      assetId,
      type: 'combine',
      chunkIndex: -1,
      renditionName,
      priority: renditionConfig.priority + COMBINE_JOB_PRIORITY_BONUS,
    },
  ])

  await VideoAsset.updateOne(
    { _id: assetId, 'renditions.name': renditionName, 'renditions.status': 'waiting' },
    { $set: { 'renditions.$.status': 'combining' } }
  )
}

const handleSplitCompleted = async (assetId, result) => {
  const renditions = selectRenditionsForSource(Math.min(result.width, result.height))

  await VideoAsset.updateOne(
    { _id: assetId },
    {
      $set: {
        status: 'processing',
        durationSeconds: result.durationSeconds,
        width: result.width,
        height: result.height,
        hasAudio: result.hasAudio,
        chunkCount: result.chunkCount,
        renditions: renditions.map((rendition) => ({
          name: rendition.name,
          height: rendition.height,
          status: 'waiting',
        })),
      },
    }
  )

  const transcodeJobs = []
  renditions.forEach((rendition) => {
    for (let chunkIndex = 0; chunkIndex < result.chunkCount; chunkIndex += 1) {
      transcodeJobs.push({
        assetId,
        type: 'transcode',
        chunkIndex,
        renditionName: rendition.name,
        priority: rendition.priority,
      })
    }
  })

  transcodeJobs.push({
    assetId,
    type: 'thumbnail',
    chunkIndex: -1,
    renditionName: '',
    priority: THUMBNAIL_JOB_PRIORITY,
  })

  await createJobs(transcodeJobs)
}

const handleCombineCompleted = async (assetId, renditionName, result) => {
  await VideoAsset.updateOne(
    { _id: assetId, 'renditions.name': renditionName },
    {
      $set: {
        'renditions.$.status': 'ready',
        'renditions.$.videoKey': result.videoKey,
        'renditions.$.indexKey': result.indexKey,
      },
    }
  )
  await createJobs([
    {
      assetId,
      type: 'luminance',
      chunkIndex: -1,
      renditionName: '',
      priority: LUMINANCE_JOB_PRIORITY,
    },
  ])
  await finalizeAssetIfReady(assetId)
}

const handleLuminanceCompleted = async (assetId, result) => {
  await VideoAsset.updateOne(
    { _id: assetId },
    {
      $set: {
        luminanceSamples: result.luminanceSamples,
        luminanceSampleSeconds: result.luminanceSampleSeconds,
      },
    }
  )
}

const handleThumbnailCompleted = async (assetId, result) => {
  if (result.skipped) return
  await VideoAsset.updateOne(
    { _id: assetId },
    {
      $set: {
        thumbnailKey: result.thumbnailKey,
        thumbnailData: result.thumbnailData,
        thumbnailContentType: THUMBNAIL_CONTENT_TYPE,
      },
    }
  )
}

const completeJob = async (job, result = {}) => {
  await VideoJob.updateOne(
    { _id: job._id },
    { $set: { status: 'done', finishedAt: new Date() }, $unset: { error: 1 } }
  )

  if (job.type === 'split') {
    await handleSplitCompleted(job.assetId, result)
    return
  }
  if (job.type === 'thumbnail') {
    await handleThumbnailCompleted(job.assetId, result)
    return
  }
  if (job.type === 'luminance') {
    await handleLuminanceCompleted(job.assetId, result)
    return
  }
  if (job.type === 'transcode') {
    await advanceRendition(job.assetId, job.renditionName)
    return
  }
  await handleCombineCompleted(job.assetId, job.renditionName, result)
}

const failJob = async (job, errorMessage) => {
  if (job.attempts >= MAX_JOB_ATTEMPTS) {
    await VideoJob.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', finishedAt: new Date(), error: errorMessage } }
    )
    if (!['thumbnail', 'luminance'].includes(job.type)) {
      await VideoAsset.updateOne(
        { _id: job.assetId },
        { $set: { status: 'failed', error: `${job.type} job failed: ${errorMessage}` } }
      )
    }
    logger.error('[cdn.scheduler] job permanently failed', {
      jobId: String(job._id),
      assetId: job.assetId,
      type: job.type,
    })
    return
  }

  await VideoJob.updateOne(
    { _id: job._id },
    { $set: { status: 'waiting', error: errorMessage }, $unset: { workerId: 1 } }
  )
}

const requeueStaleJobs = async () => {
  const staleThreshold = new Date(Date.now() - STALE_JOB_TIMEOUT_MS)
  const staleJobs = await VideoJob.find({ status: 'running', heartbeatAt: { $lt: staleThreshold } })

  for (const staleJob of staleJobs) {
    logger.warn('[cdn.scheduler] stale job detected', {
      jobId: String(staleJob._id),
      type: staleJob.type,
      chunkIndex: staleJob.chunkIndex,
      renditionName: staleJob.renditionName,
    })
    await failJob(staleJob, 'Worker stopped responding')
  }
}

const reconcileProcessingAssets = async () => {
  const processingAssets = await VideoAsset.find({ status: 'processing' })

  for (const asset of processingAssets) {
    const assetId = String(asset._id)
    for (const rendition of asset.renditions) {
      if (rendition.status === 'waiting') await advanceRendition(assetId, rendition.name)
    }
    await finalizeAssetIfReady(assetId)
  }
}

const runSchedulerTick = async () => {
  if (isTickRunning) return
  isTickRunning = true
  try {
    await requeueStaleJobs()
    await reconcileProcessingAssets()
  } catch (error) {
    logger.error('[cdn.scheduler] tick failed:', error)
  } finally {
    isTickRunning = false
  }
}

const startScheduler = () => {
  if (schedulerTimer) return
  schedulerTimer = setInterval(runSchedulerTick, SCHEDULER_INTERVAL_MS)
  logger.info('[cdn.scheduler] started', { renditionCount: RENDITIONS.length })
}

module.exports = {
  enqueueSplitJob,
  completeJob,
  failJob,
  startScheduler,
}