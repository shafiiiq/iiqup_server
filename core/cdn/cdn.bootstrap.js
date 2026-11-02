const { VIDEO_WORKERS_ENABLED } = require('./cdn.config')
const { startScheduler } = require('./cdn.scheduler')
const { startWorkers } = require('./cdn.worker')

let isStarted = false

const startVideoPipeline = () => {
  if (isStarted) return
  isStarted = true
  startScheduler()
  if (VIDEO_WORKERS_ENABLED) startWorkers()
}

module.exports = {
  startVideoPipeline,
}