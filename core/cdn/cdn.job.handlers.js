const fs = require('fs/promises')
const path = require('path')
const VideoAsset = require('./cdn.asset.model')
const {
  TRANSFER_CONCURRENCY,
  THUMBNAIL_SEEK_SECONDS,
  THUMBNAIL_CONTENT_TYPE,
  LUMINANCE_SAMPLES_PER_SECOND,
  getRenditionByName,
} = require('./cdn.config')
const {
  buildSourceChunkKey,
  buildRenditionChunkKey,
  buildRenditionVideoKey,
  buildRenditionIndexKey,
  buildThumbnailKey,
} = require('./cdn.keys')
const {
  probeVideo,
  splitIntoChunks,
  transcodeChunk,
  combineChunksIntoIndexedFile,
  extractThumbnail,
  sampleRegionLuminance,
} = require('./cdn.ffmpeg')
const { downloadObjectToFile, uploadFileToObject } = require('./cdn.storage')
const { createWorkDirectory, removeDirectory, runWithConcurrency } = require('./cdn.utils')

const VIDEO_CONTENT_TYPE = 'video/mp4'
const INDEX_CONTENT_TYPE = 'application/vnd.apple.mpegurl'

const runSplitJob = async (asset) => {
  const assetId = String(asset._id)
  const workDirectory = await createWorkDirectory('video-split')

  try {
    const sourcePath = path.join(workDirectory, 'source-video')
    const chunkDirectory = path.join(workDirectory, 'chunks')
    await fs.mkdir(chunkDirectory)

    await downloadObjectToFile(asset.sourceKey, sourcePath)
    const metadata = await probeVideo(sourcePath)
    const chunkPaths = await splitIntoChunks(sourcePath, chunkDirectory)
    await fs.rm(sourcePath, { force: true })

    await runWithConcurrency(chunkPaths, TRANSFER_CONCURRENCY, (chunkPath, chunkIndex) =>
      uploadFileToObject(chunkPath, buildSourceChunkKey(assetId, chunkIndex), VIDEO_CONTENT_TYPE)
    )

    return { ...metadata, chunkCount: chunkPaths.length }
  } finally {
    await removeDirectory(workDirectory)
  }
}

const runTranscodeJob = async (asset, job) => {
  const assetId = String(asset._id)
  const rendition = getRenditionByName(job.renditionName)
  if (!rendition) throw new Error(`Unknown rendition ${job.renditionName}`)

  const workDirectory = await createWorkDirectory('video-transcode')

  try {
    const inputPath = path.join(workDirectory, 'input-chunk.mp4')
    const outputPath = path.join(workDirectory, 'output-chunk.mp4')

    await downloadObjectToFile(buildSourceChunkKey(assetId, job.chunkIndex), inputPath)
    await transcodeChunk(inputPath, outputPath, rendition, asset.hasAudio)
    await uploadFileToObject(
      outputPath,
      buildRenditionChunkKey(assetId, rendition.name, job.chunkIndex),
      VIDEO_CONTENT_TYPE
    )

    return {}
  } finally {
    await removeDirectory(workDirectory)
  }
}

const runCombineJob = async (asset, job) => {
  const assetId = String(asset._id)
  const workDirectory = await createWorkDirectory('video-combine')

  try {
    const chunkDirectory = path.join(workDirectory, 'chunks')
    const outputDirectory = path.join(workDirectory, 'output')
    await fs.mkdir(chunkDirectory)
    await fs.mkdir(outputDirectory)

    const chunkIndexes = Array.from({ length: asset.chunkCount }, (_, chunkIndex) => chunkIndex)
    const chunkPaths = chunkIndexes.map((chunkIndex) =>
      path.join(chunkDirectory, `chunk-${String(chunkIndex).padStart(6, '0')}.mp4`)
    )

    await runWithConcurrency(chunkIndexes, TRANSFER_CONCURRENCY, (chunkIndex) =>
      downloadObjectToFile(
        buildRenditionChunkKey(assetId, job.renditionName, chunkIndex),
        chunkPaths[chunkIndex]
      )
    )

    const { videoPath, indexPath } = await combineChunksIntoIndexedFile(chunkPaths, outputDirectory)

    const videoKey = buildRenditionVideoKey(assetId, job.renditionName)
    await uploadFileToObject(videoPath, videoKey, VIDEO_CONTENT_TYPE)

    return { videoKey, indexKey: videoKey }
  } finally {
    await removeDirectory(workDirectory)
  }
}

const runThumbnailJob = async (asset) => {
  const assetId = String(asset._id)

  const hasThumbnail = await VideoAsset.exists({ _id: asset._id, thumbnailData: { $exists: true } })
  if (hasThumbnail) return { skipped: true }

  const workDirectory = await createWorkDirectory('video-thumbnail')

  try {
    const inputPath = path.join(workDirectory, 'input-chunk.mp4')
    const outputPath = path.join(workDirectory, 'thumbnail.jpg')
    const seekSeconds = Math.min(THUMBNAIL_SEEK_SECONDS, Math.max(0, (asset.durationSeconds || 0) / 2))

    await downloadObjectToFile(buildSourceChunkKey(assetId, 0), inputPath)
    await extractThumbnail(inputPath, outputPath, seekSeconds)

    const thumbnailKey = buildThumbnailKey(assetId)
    await uploadFileToObject(outputPath, thumbnailKey, THUMBNAIL_CONTENT_TYPE)
    const thumbnailData = await fs.readFile(outputPath)

    return { thumbnailKey, thumbnailData }
    return { thumbnailKey }
  } finally {
    await removeDirectory(workDirectory)
  }
}

const runLuminanceJob = async (asset) => {
  const sourceRendition = asset.renditions
    .filter((rendition) => rendition.status === 'ready' && rendition.videoKey)
    .sort((first, second) => first.height - second.height)[0]
  if (!sourceRendition) throw new Error('No ready rendition available for luminance sampling')

  const workDirectory = await createWorkDirectory('video-luminance')

  try {
    const inputPath = path.join(workDirectory, 'rendition-video.mp4')
    await downloadObjectToFile(sourceRendition.videoKey, inputPath)
    const luminanceSamples = await sampleRegionLuminance(inputPath)

    return { luminanceSamples, luminanceSampleSeconds: 1 / LUMINANCE_SAMPLES_PER_SECOND }
  } finally {
    await removeDirectory(workDirectory)
  }
}

module.exports = {
  runLuminanceJob,
  runThumbnailJob,
  runSplitJob,
  runTranscodeJob,
  runCombineJob,
}