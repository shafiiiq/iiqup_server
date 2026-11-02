const { getObjectStream } = require('./s3.config')

const readObjectBuffer = async (key) => {
  const chunks = []
  for await (const chunk of await getObjectStream(key)) chunks.push(chunk)
  return Buffer.concat(chunks)
}

module.exports = { readObjectBuffer }