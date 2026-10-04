const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { Upload } = require('@aws-sdk/lib-storage')
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

const buildContentDisposition = (downloadFileName) => {
  const asciiFileName = downloadFileName.replace(/[^\x20-\x7E]|["\\;]/g, '_')
  const encodedFileName = encodeURIComponent(downloadFileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
}

const getObjectUrl = async (key, isLong, isAuthSign = false, downloadFileName = '') => {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    ...(downloadFileName ? { ResponseContentDisposition: buildContentDisposition(downloadFileName) } : {}),
  })
  return getSignedUrl(s3Client, command, { expiresIn: getExpiresIn(isLong, isAuthSign) })
}

const getObjectStream = async (key) => {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }))
  return response.Body
}

const uploadStream = async (key, bodyStream, contentType) => {
  const upload = new Upload({
    client: s3Client,
    params: { Bucket: process.env.BUCKET_NAME, Key: key, Body: bodyStream, ContentType: contentType },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  })
  await upload.done()
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

const copyObject = async (sourceKey, destinationKey) => {
  const command = new CopyObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: destinationKey,
    CopySource: encodeURIComponent(`${process.env.BUCKET_NAME}/${sourceKey}`),
  })
  await s3Client.send(command)
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
  copyObject,
  getObjectStream,
  uploadStream,
  objectExists,
  createMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
}