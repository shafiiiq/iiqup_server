const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
});

const getObjectUrl = async (key, isLong, isAuthSign = false) => {
    // Use GetObjectCommand instead of GetObjectAclCommand for getting object URLs
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key // Note: Capital 'K' in Key
    });

    let expiresIn;
    if (!isLong) {
        expiresIn = 3600; // 1 hour
    } else if (isAuthSign) {
        expiresIn = 10;  // 10 seconds
    } else {
        expiresIn = 86400; // 24 hours
    }
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
};

const putObject = async (fileName, key, contentType) => {
    const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        ContentType: contentType
    })
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 })
    return url
}

module.exports = { getObjectUrl, putObject };