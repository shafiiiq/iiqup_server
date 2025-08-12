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

const getObjectUrl = async (key) => {
    // Use GetObjectCommand instead of GetObjectAclCommand for getting object URLs
    const command = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key // Note: Capital 'K' in Key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
    return url;
};

const putObject = async (fileName, key, contentType) => {
    const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
        ContentType: contentType
    })
    const url = await getSignedUrl(s3Client,command, {expiresIn:60})
    return url
}

module.exports = { getObjectUrl, putObject };