const JOB_QUEUE_CONCURRENCY = Number(process.env.JOB_QUEUE_CONCURRENCY) || 4

module.exports = { JOB_QUEUE_CONCURRENCY }