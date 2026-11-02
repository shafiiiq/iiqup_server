const logger = require('#shared/logger/logger')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { getObjectUrl } = require('#core/s3/s3.config')
const VideoAsset = require('./cdn.asset.model')
const VideoJob = require('./cdn.job.model')
const {
  RENDITION_VIDEO_FILE_NAME,
  PLAYBACK_URL_LONG_EXPIRY,
  PLAYLIST_CONTENT_TYPE,
} = require('./cdn.config')
const { buildRenditionPlaybackKey } = require('./cdn.keys')
const { enqueueSplitJob } = require('./cdn.scheduler')
const { readObjectAsText, uploadTextToObject } = require('./cdn.storage')
const { isDuplicateKeyError } = require('./cdn.utils')

const UploadSession = require('#core/upload/upload.model')

const isVideoMimeType = (mimeType) => !!mimeType && mimeType.toLowerCase().startsWith('video/')

const applyThumbnailToAsset = async (sourceSessionId, thumbnailData, thumbnailContentType) => {
  await VideoAsset.updateOne({ sourceSessionId }, { $set: { thumbnailData, thumbnailContentType } })
}

const registerVideoAsset = async (session) => {
  if (!isVideoMimeType(session.mimeType)) return null

  const sourceSessionId = String(session._id)
  const existingAsset = await VideoAsset.findOne({ sourceSessionId })
  if (existingAsset) return existingAsset

  const sessionThumbnail = await UploadSession.findById(session._id).select('+thumbnailData thumbnailContentType')

  try {
    const asset = await VideoAsset.create({
      sourceSessionId,
      thumbnailData: sessionThumbnail?.thumbnailData,
      thumbnailContentType: sessionThumbnail?.thumbnailContentType,
      sourceKey: session.s3Key,
      sourceMimeType: session.mimeType,
      sourceFileName: session.originalName,
      feature: session.feature,
      uploadedBy: session.uploadedBy,
      status: 'waiting',
    })
    await enqueueSplitJob(String(asset._id))
    logger.info('[cdn.service] video asset registered', {
      assetId: String(asset._id),
      sourceKey: session.s3Key,
    })
    return asset
  } catch (error) {
    if (isDuplicateKeyError(error)) return VideoAsset.findOne({ sourceSessionId })
    throw error
  }
}

const findAssetOrThrow = async (assetId) => {
  const asset = await VideoAsset.findById(assetId)
  if (!asset) throw new AppError('Video asset not found', HTTP.NOT_FOUND)
  return asset
}

const buildAssetSummary = (asset) => ({
  assetId: String(asset._id),
  sourceKey: asset.sourceKey,
  status: asset.status,
  durationSeconds: asset.durationSeconds,
  chunkCount: asset.chunkCount,
  error: asset.error,
  renditions: asset.renditions.map((rendition) => ({
    name: rendition.name,
    status: rendition.status,
  })),
})

const getAssetBySourceKey = async (sourceKey) => {
  if (!sourceKey) throw new AppError('key is required', HTTP.BAD_REQUEST)
  const asset = await VideoAsset.findOne({ sourceKey })
  if (!asset) throw new AppError('Video asset not found', HTTP.NOT_FOUND)
  return {
    ...buildAssetSummary(asset),
    luminance: {
      sampleSeconds: asset.luminanceSampleSeconds || 0,
      samples: asset.luminanceSamples || [],
    },
  }
}

const getAssetStatus = async (assetId) => {
  const asset = await findAssetOrThrow(assetId)
  const [doneJobs, totalJobs] = await Promise.all([
    VideoJob.countDocuments({ assetId, status: 'done' }),
    VideoJob.countDocuments({ assetId }),
  ])
  return { ...buildAssetSummary(asset), progress: { doneJobs, totalJobs } }
}

const getMasterPlaylist = async (assetId) => {
  const asset = await findAssetOrThrow(assetId)
  if (asset.status !== 'ready' || !asset.masterKey) {
    throw new AppError('Video is still processing', HTTP.CONFLICT)
  }
  return readObjectAsText(asset.masterKey)
}

const getRenditionPlaylist = async (assetId, renditionName) => {
  const asset = await findAssetOrThrow(assetId)
  const rendition = asset.renditions.find((candidate) => candidate.name === renditionName)
  if (!rendition || rendition.status !== 'ready') {
    throw new AppError('Rendition not available', HTTP.NOT_FOUND)
  }

  const playlistText = await readObjectAsText(rendition.indexKey)
  const signedVideoUrl = await getObjectUrl(rendition.videoKey, PLAYBACK_URL_LONG_EXPIRY)
  return playlistText.split(RENDITION_VIDEO_FILE_NAME).join(signedVideoUrl)
}

const getRenditionPlaybackUrl = async (assetId, renditionName) => {
  const asset = await findAssetOrThrow(assetId)
  const rendition = asset.renditions.find((candidate) => candidate.name === renditionName)
  if (!rendition || rendition.status !== 'ready') {
    throw new AppError('Rendition not available', HTTP.NOT_FOUND)
  }

  const url = await getObjectUrl(rendition.videoKey, PLAYBACK_URL_LONG_EXPIRY)

  return { url }
}

const getRenditionDownloadUrl = async (assetId, renditionName) => {
  const asset = await findAssetOrThrow(assetId)
  const rendition = asset.renditions.find((candidate) => candidate.name === renditionName)
  if (!rendition || rendition.status !== 'ready') {
    throw new AppError('Rendition not available', HTTP.NOT_FOUND)
  }

  const fileName = `${assetId}-${renditionName}.mp4`
  const url = await getObjectUrl(rendition.videoKey, PLAYBACK_URL_LONG_EXPIRY, false, fileName)
  return { url, fileName }
}

const getThumbnailBySourceKey = async (sourceKey) => {
  if (!sourceKey) throw new AppError('key is required', HTTP.BAD_REQUEST)
  const asset = await VideoAsset.findOne({ sourceKey }).select('+thumbnailData thumbnailContentType thumbnailKey')

  if (asset?.thumbnailData?.length) {
    const contentType = asset.thumbnailContentType || 'image/jpeg'
    return { url: `data:${contentType};base64,${asset.thumbnailData.toString('base64')}` }
  }

  if (!asset || !asset.thumbnailKey) throw new AppError('Thumbnail not available', HTTP.NOT_FOUND)
  const url = await getObjectUrl(asset.thumbnailKey, PLAYBACK_URL_LONG_EXPIRY)
  return { url }
}

module.exports = {
  applyThumbnailToAsset,
  getRenditionDownloadUrl,
  getRenditionPlaybackUrl,
  getThumbnailBySourceKey,
  registerVideoAsset,
  getAssetBySourceKey,
  getAssetStatus,
  getMasterPlaylist,
  getRenditionPlaylist,
}