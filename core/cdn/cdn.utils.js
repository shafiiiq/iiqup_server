const fs = require('fs/promises')
const os = require('os')
const path = require('path')

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
  wait,
  createWorkDirectory,
  removeDirectory,
  isDuplicateKeyError,
  runWithConcurrency,
}