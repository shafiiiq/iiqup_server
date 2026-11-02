const toPositiveInteger = (value, fallbackValue) => {
  const parsedValue = parseInt(value, 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue
}

const CHUNK_SECONDS = 5

const RENDITIONS = [
  { name: '360p', height: 360, videoBitrate: '800k', maxRate: '900k', bufferSize: '1600k', audioBitrate: '96k', bandwidth: 900000, priority: 50 },
  { name: '480p', height: 480, videoBitrate: '1400k', maxRate: '1500k', bufferSize: '2800k', audioBitrate: '128k', bandwidth: 1600000, priority: 40 },
  { name: '720p', height: 720, videoBitrate: '2800k', maxRate: '3000k', bufferSize: '5600k', audioBitrate: '128k', bandwidth: 3200000, priority: 30 },
  { name: '1080p', height: 1080, videoBitrate: '5000k', maxRate: '5400k', bufferSize: '10000k', audioBitrate: '192k', bandwidth: 5600000, priority: 20 },
  { name: '4k', height: 2160, videoBitrate: '14000k', maxRate: '15000k', bufferSize: '28000k', audioBitrate: '192k', bandwidth: 15200000, priority: 10 },
]

const SPLIT_JOB_PRIORITY = 1000
const THUMBNAIL_JOB_PRIORITY = 900
const THUMBNAIL_WIDTH = 480
const THUMBNAIL_SEEK_SECONDS = 1
const THUMBNAIL_FILE_NAME = 'thumbnail.jpg'
const THUMBNAIL_CONTENT_TYPE = 'image/jpeg'
const COMBINE_JOB_PRIORITY_BONUS = 500
const LUMINANCE_JOB_PRIORITY = 800
const LUMINANCE_SAMPLES_PER_SECOND = 2
const LUMINANCE_REGION = { x: 0.8, y: 0.4, width: 0.2, height: 0.4 }

const MAX_JOB_ATTEMPTS = toPositiveInteger(process.env.VIDEO_MAX_JOB_ATTEMPTS, 5)
const STALE_JOB_TIMEOUT_MS = toPositiveInteger(process.env.VIDEO_STALE_JOB_TIMEOUT_MS, 60000)
const HEARTBEAT_INTERVAL_MS = 15000
const SCHEDULER_INTERVAL_MS = toPositiveInteger(process.env.VIDEO_SCHEDULER_INTERVAL_MS, 5000)
const WORKER_POLL_INTERVAL_MS = 2000
const WORKER_CONCURRENCY = toPositiveInteger(process.env.VIDEO_WORKER_CONCURRENCY, 2)
const VIDEO_WORKERS_ENABLED = process.env.VIDEO_WORKERS_ENABLED !== 'false'
const TRANSFER_CONCURRENCY = 4

const RENDITION_VIDEO_FILE_NAME = 'video.mp4'
const RENDITION_INDEX_FILE_NAME = 'index.m3u8'
const MASTER_PLAYLIST_FILE_NAME = 'master.m3u8'
const PLAYLIST_CONTENT_TYPE = 'application/vnd.apple.mpegurl'
const PLAYBACK_URL_LONG_EXPIRY = true

const getRenditionByName = (renditionName) =>
  RENDITIONS.find((rendition) => rendition.name === renditionName)

const selectRenditionsForSource = (sourceShortSide) => {
  const eligibleRenditions = RENDITIONS.filter((rendition) => rendition.height <= sourceShortSide)
  return eligibleRenditions.length > 0 ? eligibleRenditions : [RENDITIONS[0]]
}

module.exports = {
  CHUNK_SECONDS,
  RENDITIONS,
  SPLIT_JOB_PRIORITY,
  THUMBNAIL_JOB_PRIORITY,
  LUMINANCE_JOB_PRIORITY,
  LUMINANCE_SAMPLES_PER_SECOND,
  LUMINANCE_REGION,
  THUMBNAIL_WIDTH,
  THUMBNAIL_SEEK_SECONDS,
  THUMBNAIL_FILE_NAME,
  THUMBNAIL_CONTENT_TYPE,
  COMBINE_JOB_PRIORITY_BONUS,
  MAX_JOB_ATTEMPTS,
  STALE_JOB_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  SCHEDULER_INTERVAL_MS,
  WORKER_POLL_INTERVAL_MS,
  WORKER_CONCURRENCY,
  VIDEO_WORKERS_ENABLED,
  TRANSFER_CONCURRENCY,
  RENDITION_VIDEO_FILE_NAME,
  RENDITION_INDEX_FILE_NAME,
  MASTER_PLAYLIST_FILE_NAME,
  PLAYLIST_CONTENT_TYPE,
  PLAYBACK_URL_LONG_EXPIRY,
  getRenditionByName,
  selectRenditionsForSource,
}