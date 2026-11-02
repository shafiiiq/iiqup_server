const { listUploadedParts } = require('#core/s3/s3.config')

const sumPartBytes = (parts) => parts.reduce((totalBytes, part) => totalBytes + (part.size || 0), 0)

const resolveUploadedBytes = async (session) => {
  const listedParts = await listUploadedParts(session.s3Key, session.s3UploadId)
  const largestKnownBytes = Math.max(sumPartBytes(listedParts), sumPartBytes(session.parts))
  return Math.min(session.fileSize, largestKnownBytes)
}

const calculateBatchProgress = (liveActivity, uploadedBytes) => {
  if (!liveActivity.batchTotalBytes || liveActivity.batchTotalBytes <= 0) return 0
  const progress = (liveActivity.bytesBeforeItem + uploadedBytes) / liveActivity.batchTotalBytes
  return Math.min(1, Math.max(0, progress))
}

module.exports = {
  resolveUploadedBytes,
  calculateBatchProgress,
}