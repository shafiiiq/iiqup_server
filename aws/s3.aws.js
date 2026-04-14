const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// ─── Client ───────────────────────────────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getExpiresIn = (isLong, isAuthSign) => {
  if (isAuthSign) return 10;         // 10 seconds
  if (isLong)     return 86400;      // 24 hours
  return 3600;                       // 1 hour
};

// ─── Methods ──────────────────────────────────────────────────────────────────

const getObjectUrl = async (key, isLong, isAuthSign = false) => {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key:    key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: getExpiresIn(isLong, isAuthSign) });
  return url;
};

const putObject = async (fileName, key, contentType) => {
  const command = new PutObjectCommand({
    Bucket:      process.env.BUCKET_NAME,
    Key:         key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return url;
};

const deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key:    key,
  });

  await s3Client.send(command);
  return { success: true, message: `Object ${key} deleted successfully` };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { getObjectUrl, putObject, deleteObject };