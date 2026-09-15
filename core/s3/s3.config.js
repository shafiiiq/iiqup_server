const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
require('dotenv').config()

const AUTH_SIGN_EXPIRY_SECONDS = 100
const LONG_EXPIRY_SECONDS = 86400
const DEFAULT_EXPIRY_SECONDS = 3600
const PUT_URL_EXPIRY_SECONDS = 900

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})

const getExpiresIn = (isLong, isAuthSign) => {
  if (isAuthSign) return AUTH_SIGN_EXPIRY_SECONDS
  if (isLong) return LONG_EXPIRY_SECONDS
  return DEFAULT_EXPIRY_SECONDS
}

const getObjectUrl = async (key, isLong, isAuthSign = false) => {
  const command = new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: getExpiresIn(isLong, isAuthSign) })
}

const putObject = async (fileName, key, contentType) => {
  const command = new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key, ContentType: contentType })
  return getSignedUrl(s3Client, command, { expiresIn: PUT_URL_EXPIRY_SECONDS })
}

const deleteObject = async (key) => {
  const command = new DeleteObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key })
  await s3Client.send(command)
  return { success: true, message: `Object ${key} deleted successfully` }
}

const objectExists = async (key) => {
  try {
    const command = new HeadObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key })
    await s3Client.send(command)
    return true
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return false
    throw error
  }
}

const createMultipartUpload = async (key, contentType) => {
  const command = new CreateMultipartUploadCommand({ Bucket: process.env.BUCKET_NAME, Key: key, ContentType: contentType })
  const response = await s3Client.send(command)
  return response.UploadId
}

const getUploadPartUrl = async (key, uploadId, partNumber) => {
  const command = new UploadPartCommand({ Bucket: process.env.BUCKET_NAME, Key: key, UploadId: uploadId, PartNumber: partNumber })
  return getSignedUrl(s3Client, command, { expiresIn: DEFAULT_EXPIRY_SECONDS })
}

const completeMultipartUpload = async (key, uploadId, parts) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })) },
  })
  return s3Client.send(command)
}

const abortMultipartUpload = async (key, uploadId) => {
  const command = new AbortMultipartUploadCommand({ Bucket: process.env.BUCKET_NAME, Key: key, UploadId: uploadId })
  return s3Client.send(command)
}

module.exports = {
  getObjectUrl,
  putObject,
  deleteObject,
  objectExists,
  createMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
}