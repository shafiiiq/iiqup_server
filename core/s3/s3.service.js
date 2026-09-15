const { getObjectUrl, putObject, objectExists } = require('./s3.config')
const { processVideoForStreaming } = require('./s3.processor')
const logger = require('#shared/logger/logger')

const NOT_FOUND_STATUS = 404
const OK_STATUS = 200
const SERVER_ERROR_STATUS = 500

const fetchPresignedURL = async (s3Key, isLong, isAuthSign = false) => {
  try {
    const exists = await objectExists(s3Key)
    if (!exists) {
      logger.warn('[S3Service] fetchPresignedURL object missing', { s3Key })
      return { status: NOT_FOUND_STATUS, ok: false, message: 'S3 object not found' }
    }

    const dataUrl = await getObjectUrl(s3Key, isLong, isAuthSign)
    logger.info('[S3Service] fetchPresignedURL success', { s3Key, isLong, isAuthSign })

    return { status: OK_STATUS, ok: true, dataUrl }
  } catch (error) {
    logger.error('[S3Service] fetchPresignedURL:', error)
    return { status: SERVER_ERROR_STATUS, ok: false, message: error.message || 'Error fetching presigned URL' }
  }
}

const uploadToS3 = async (fileBuffer, s3Key, mimeType) => {
  try {
    const processedBuffer = await processVideoForStreaming(fileBuffer, mimeType)

    const uploadUrl = await putObject('upload', s3Key, mimeType)
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: processedBuffer,
      headers: { 'Content-Type': mimeType },
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '')
      throw new Error(`S3 upload failed with status: ${uploadResponse.status}${errorText ? ` - ${errorText}` : ''}`)
    }

    return { status: OK_STATUS, ok: true, message: 'File uploaded successfully', s3Key, uploadUrl }
  } catch (error) {
    logger.error('[S3Service] uploadToS3:', error)
    throw new Error(error.message || 'Error uploading file to S3', { cause: error })
  }
}

module.exports = { fetchPresignedURL, uploadToS3 }  