const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const VIDEO_FILE_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', '3gp', 'mpeg', 'mpg', 'wmv', 'flv', 'ts']

const isVideoFile = (mimeType, fileName) => {
  if (mimeType && mimeType.toLowerCase().startsWith('video/')) return true
  const extension = path.extname(fileName || '').slice(1).toLowerCase()
  return VIDEO_FILE_EXTENSIONS.includes(extension)
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const createWorkDirectory = (prefix) => fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`))

const removeDirectory = (directoryPath) => fs.rm(directoryPath, { recursive: true, force: true })

const isDuplicateKeyError = (error) =>
  error?.code === 11000 ||
  (Array.isArray(error?.writeErrors) &&
    error.writeErrors.length > 0 &&
    error.writeErrors.every((writeError) => (writeError.code ?? writeError.err?.code) === 11000))

const runWithConcurrency = async (items, concurrencyLimit, task) => {
  let nextIndex = 0
  let hasFailed = false

  const runner = async () => {
    while (!hasFailed && nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      try {
        await task(items[currentIndex], currentIndex)
      } catch (error) {
        hasFailed = true
        throw error
      }
    }
  }

  const runnerCount = Math.min(concurrencyLimit, items.length)
  await Promise.all(Array.from({ length: runnerCount }, runner))
}

module.exports = {
  isVideoFile,
  wait,
  createWorkDirectory,
  removeDirectory,
  isDuplicateKeyError,
  runWithConcurrency,
}