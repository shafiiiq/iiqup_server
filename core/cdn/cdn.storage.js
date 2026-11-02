const fs = require('fs')
const { pipeline } = require('stream/promises')
const { getObjectStream, uploadStream } = require('#core/s3/s3.config')

const downloadObjectToFile = async (objectKey, destinationPath) => {
  const bodyStream = await getObjectStream(objectKey)
  await pipeline(bodyStream, fs.createWriteStream(destinationPath))
}

const uploadFileToObject = async (sourcePath, objectKey, contentType) => {
  await uploadStream(objectKey, fs.createReadStream(sourcePath), contentType)
}

const uploadTextToObject = async (objectKey, text, contentType) => {
  await uploadStream(objectKey, Buffer.from(text, 'utf8'), contentType)
}

const readObjectAsText = async (objectKey) => {
  const bodyStream = await getObjectStream(objectKey)
  return bodyStream.transformToString('utf8')
}

module.exports = {
  downloadObjectToFile,
  uploadFileToObject,
  uploadTextToObject,
  readObjectAsText,
}