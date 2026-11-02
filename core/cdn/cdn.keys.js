const {
  RENDITION_VIDEO_FILE_NAME,
  RENDITION_INDEX_FILE_NAME,
  MASTER_PLAYLIST_FILE_NAME,
  THUMBNAIL_FILE_NAME,
} = require('./cdn.config')

const CHUNK_INDEX_PADDING = 6

const formatChunkFileName = (chunkIndex) =>
  `chunk-${String(chunkIndex).padStart(CHUNK_INDEX_PADDING, '0')}.mp4`

const buildAssetPrefix = (assetId) => `video-processing/${assetId}`

const buildSourceChunkKey = (assetId, chunkIndex) =>
  `${buildAssetPrefix(assetId)}/chunks/${formatChunkFileName(chunkIndex)}`

const buildRenditionChunkKey = (assetId, renditionName, chunkIndex) =>
  `${buildAssetPrefix(assetId)}/renditions/${renditionName}/chunks/${formatChunkFileName(chunkIndex)}`

const buildRenditionVideoKey = (assetId, renditionName) =>
  `${buildAssetPrefix(assetId)}/renditions/${renditionName}/${RENDITION_VIDEO_FILE_NAME}`

const buildRenditionIndexKey = (assetId, renditionName) =>
  `${buildAssetPrefix(assetId)}/renditions/${renditionName}/${RENDITION_INDEX_FILE_NAME}`

const buildMasterPlaylistKey = (assetId) =>
  `${buildAssetPrefix(assetId)}/${MASTER_PLAYLIST_FILE_NAME}`

const buildThumbnailKey = (assetId) =>
  `${buildAssetPrefix(assetId)}/${THUMBNAIL_FILE_NAME}`

const buildRenditionPlaybackKey = (assetId, renditionName) =>
  `${buildAssetPrefix(assetId)}/renditions/${renditionName}/playback.m3u8`

module.exports = {
  buildRenditionPlaybackKey,
  buildThumbnailKey,
  buildSourceChunkKey,
  buildRenditionChunkKey,
  buildRenditionVideoKey,
  buildRenditionIndexKey,
  buildMasterPlaylistKey,
}