const PurchaseOrder = require('./purchase.model')

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

const startOfWeek = (date) => {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

const endOfWeek = (date) => {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return endOfDay(d)
}

const startOfMonth = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfMonth = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return endOfDay(d)
}

const startOfYear = (date) => {
  const d = new Date(date.getFullYear(), 0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfYear = (date) => {
  const d = new Date(date.getFullYear(), 11, 31)
  return endOfDay(d)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
})

const GRANULARITY_CONFIG = {
  today: {
    rangeStart: (now) => startOfDay(now),
    rangeEnd: (now) => endOfDay(now),
    previousRangeStart: (now) => startOfDay(new Date(now.getTime() - DAY_MS)),
    previousRangeEnd: (now) => endOfDay(new Date(now.getTime() - DAY_MS)),
    bucketCount: 24,
    bucketLabel: (index) => HOUR_LABELS[index],
    bucketIndex: (date) => date.getHours(),
    rangeLabel: 'Today',
  },
  week: {
    rangeStart: (now) => startOfWeek(now),
    rangeEnd: (now) => endOfWeek(now),
    previousRangeStart: (now) => startOfWeek(new Date(startOfWeek(now).getTime() - DAY_MS)),
    previousRangeEnd: (now) => endOfWeek(new Date(startOfWeek(now).getTime() - DAY_MS)),
    bucketCount: 7,
    bucketLabel: (index) => WEEKDAY_LABELS[index],
    bucketIndex: (date) => date.getDay(),
    rangeLabel: 'This Week',
  },
  month: {
    rangeStart: (now) => startOfMonth(now),
    rangeEnd: (now) => endOfMonth(now),
    previousRangeStart: (now) => startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    previousRangeEnd: (now) => endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    bucketCount: 5,
    bucketLabel: (index) => `Week ${index + 1}`,
    bucketIndex: (date) => Math.min(4, Math.floor((date.getDate() - 1) / 7)),
    rangeLabel: 'This Month',
  },
  year: {
    rangeStart: (now) => startOfYear(now),
    rangeEnd: (now) => endOfYear(now),
    previousRangeStart: (now) => startOfYear(new Date(now.getFullYear() - 1, 0, 1)),
    previousRangeEnd: (now) => endOfYear(new Date(now.getFullYear() - 1, 0, 1)),
    bucketCount: 12,
    bucketLabel: (index) => MONTH_LABELS[index],
    bucketIndex: (date) => date.getMonth(),
    rangeLabel: 'This Year',
  },
}

const buildEmptyBuckets = (config) =>
  Array.from({ length: config.bucketCount }, (_, index) => ({
    label: config.bucketLabel(index),
    total: 0,
    count: 0,
  }))

const sumDocsIntoBuckets = (docs, config) => {
  const buckets = buildEmptyBuckets(config)
  for (const doc of docs) {
    const index = config.bucketIndex(new Date(doc.createdAt))
    if (index < 0 || index >= buckets.length) continue
    buckets[index].total += doc.totalAmount || 0
    buckets[index].count += 1
  }
  return buckets
}

const fetchDocsInRange = async (rangeStart, rangeEnd) =>
  PurchaseOrder.find(
    { createdAt: { $gte: rangeStart, $lte: rangeEnd } },
    { createdAt: 1, totalAmount: 1 }
  ).lean()

const sumTotals = (docs) =>
  docs.reduce(
    (acc, doc) => {
      acc.total += doc.totalAmount || 0
      acc.count += 1
      return acc
    },
    { total: 0, count: 0 }
  )

const getAllTimeTotals = async () => {
  const [result] = await PurchaseOrder.aggregate([
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
  ])
  const total = result?.total || 0
  const count = result?.count || 0
  return {
    totalCost: total,
    totalCount: count,
    averageCost: count > 0 ? total / count : 0,
  }
}

const getYearRangeFromData = async () => {
  const oldest = await PurchaseOrder.findOne({}).sort({ createdAt: 1 }).select('createdAt').lean()
  const currentYear = new Date().getFullYear()
  const earliestYear = oldest?.createdAt ? new Date(oldest.createdAt).getFullYear() : currentYear
  return { earliestYear, currentYear }
}

const getSeriesByYear = async () => {
  const { earliestYear, currentYear } = await getYearRangeFromData()
  const years = []
  for (let year = earliestYear; year <= currentYear; year += 1) years.push(year)

  const grouped = await PurchaseOrder.aggregate([
    {
      $group: {
        _id: { $year: '$createdAt' },
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
  ])

  const totalsByYear = new Map(grouped.map((row) => [row._id, { total: row.total || 0, count: row.count || 0 }]))

  const buckets = years.map((year) => {
    const entry = totalsByYear.get(year) || { total: 0, count: 0 }
    return { label: String(year), total: entry.total, count: entry.count }
  })

  return { granularity: 'allYears', rangeLabel: 'By Year', buckets }
}

const getSeries = async (granularity) => {
  if (granularity === 'allYears') return getSeriesByYear()

  const config = GRANULARITY_CONFIG[granularity]
  if (!config) throw new Error(`Unsupported granularity: ${granularity}`)

  const now = new Date()
  const rangeStart = config.rangeStart(now)
  const rangeEnd = config.rangeEnd(now)
  const docs = await fetchDocsInRange(rangeStart, rangeEnd)
  const buckets = sumDocsIntoBuckets(docs, config)

  return { granularity, rangeLabel: config.rangeLabel, buckets, rangeStart, rangeEnd }
}

const getSummary = async (granularity) => {
  const allTime = await getAllTimeTotals()

  if (granularity === 'allYears') {
    const series = await getSeriesByYear()
    const current = series.buckets[series.buckets.length - 1] || { total: 0, count: 0 }
    const previous = series.buckets[series.buckets.length - 2] || { total: 0, count: 0 }
    const growthPercent =
      previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : current.total > 0 ? 100 : 0

    return {
      granularity,
      rangeLabel: series.rangeLabel,
      totalCost: current.total,
      totalCount: current.count,
      previousTotalCost: previous.total,
      previousTotalCount: previous.count,
      growthPercent,
      averageCost: current.count > 0 ? current.total / current.count : 0,
      allTimeTotalCost: allTime.totalCost,
      allTimeTotalCount: allTime.totalCount,
      allTimeAverageCost: allTime.averageCost,
    }
  }

  const config = GRANULARITY_CONFIG[granularity]
  if (!config) throw new Error(`Unsupported granularity: ${granularity}`)

  const now = new Date()
  const currentDocs = await fetchDocsInRange(config.rangeStart(now), config.rangeEnd(now))
  const previousDocs = await fetchDocsInRange(config.previousRangeStart(now), config.previousRangeEnd(now))

  const current = sumTotals(currentDocs)
  const previous = sumTotals(previousDocs)
  const growthPercent =
    previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : current.total > 0 ? 100 : 0

  return {
    granularity,
    rangeLabel: config.rangeLabel,
    totalCost: current.total,
    totalCount: current.count,
    previousTotalCost: previous.total,
    previousTotalCount: previous.count,
    growthPercent,
    averageCost: current.count > 0 ? current.total / current.count : 0,
    allTimeTotalCost: allTime.totalCost,
    allTimeTotalCount: allTime.totalCount,
    allTimeAverageCost: allTime.averageCost,
  }
}

const getGrowth = async (granularity) => {
  const series = await getSeries(granularity)

  let cumulativeTotal = 0
  const buckets = series.buckets.map((bucket) => {
    cumulativeTotal += bucket.total
    return { ...bucket, cumulativeTotal }
  })

  return { granularity, rangeLabel: series.rangeLabel, buckets }
}

module.exports = {
  getAllTimeTotals,
  getSeries,
  getSummary,
  getGrowth,
}