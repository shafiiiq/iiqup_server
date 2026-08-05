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
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// ─── Client ───────────────────────────────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getExpiresIn = (isLong, isAuthSign) => {
  if (isAuthSign) return 100; // 10 seconds
  if (isLong) return 86400; // 24 hours
  return 3600; // 1 hour
};

// ─── Methods ──────────────────────────────────────────────────────────────────

const getObjectUrl = async (key, isLong, isAuthSign = false) => {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: getExpiresIn(isLong, isAuthSign),
  });
  return url;
};

const putObject = async (fileName, key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
};

const deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
  return { success: true, message: `Object ${key} deleted successfully` };
};

const objectExists = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
};

// ─── Multipart methods ────────────────────────────────────────────────────────

const createMultipartUpload = async (key, contentType) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const response = await s3Client.send(command);
  return response.UploadId;
};

const getUploadPartUrl = async (key, uploadId, partNumber) => {
  const command = new UploadPartCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const completeMultipartUpload = async (key, uploadId, parts) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
    },
  });
  return s3Client.send(command);
};

const abortMultipartUpload = async (key, uploadId) => {
  const command = new AbortMultipartUploadCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });
  return s3Client.send(command);
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getObjectUrl,
  putObject,
  deleteObject,
  objectExists,
  createMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
};
