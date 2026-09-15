const { buildBuckets, isValidGranularity } = require('./dashboard.period');
const { listRegistryOptions, getSchemaMap, getRegistryEntry } = require('./registry/registry.util');
const {
  sumCounts, countAllModelsInRange, countAllModelsAllTime, countModelByFieldValue,
  fetchModelRecordsPage, fetchRecentDocsAcrossModels,
} = require('./dashboard.aggregator');
const { computeNetScore, splitCountsByDirection } = require('./dashboard.growth');
const { setCache, getCache, clearCache } = require('./dashboard.cache');
const { ValidationError, NotFoundError } = require('#shared/errors/error.http');

const assertGranularity = (granularity) => {
  if (!isValidGranularity(granularity)) {
    throw new ValidationError(`Unsupported granularity: ${granularity}`);
  }
};

const assertRegistryKey = (key) => {
  const entry = getRegistryEntry(key);
  if (!entry) throw new NotFoundError(`Unknown collection: ${key}`);
  return entry;
};

const getNumbers = async (granularity) => {
  assertGranularity(granularity);
  const cacheKey = `numbers:${granularity}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const buckets = buildBuckets(granularity);
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  const counts = await countAllModelsInRange(rangeStart, rangeEnd);

  const result = {
    granularity,
    range: { start: rangeStart, end: rangeEnd },
    total: sumCounts(counts),
    counts,
    netScore: computeNetScore(counts),
    directionTotals: splitCountsByDirection(counts),
    collections: listRegistryOptions(),
  };

  setCache(cacheKey, result, 60000);
  return result;
};

const getBucketedStats = async (granularity) => {
  assertGranularity(granularity);
  const cacheKey = `stats:${granularity}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const buckets = buildBuckets(granularity);
  const points = await Promise.all(
    buckets.map(async ({ label, start, end }) => {
      const counts = await countAllModelsInRange(start, end);
      return {
        label,
        start,
        end,
        counts,
        total: sumCounts(counts),
        netScore: computeNetScore(counts),
        directionTotals: splitCountsByDirection(counts),
      };
    })
  );

  let cumulativeNetScore = 0;
  const series = points.map((point) => {
    cumulativeNetScore += point.netScore;
    return { ...point, cumulativeNetScore };
  });

  const result = { granularity, series, collections: listRegistryOptions() };

  setCache(cacheKey, result, 60000);
  return result;
};

const getBreakdown = async (key, field) => {
  const entry = assertRegistryKey(key);
  if (!field) throw new ValidationError('field query parameter is required');

  const cacheKey = `breakdown:${key}:${field}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const values = await countModelByFieldValue(key, field);
  const result = { key, label: entry.label, field, values };

  setCache(cacheKey, result, 60000);
  return result;
};

const getRecords = async (key, granularity, pagination) => {
  assertGranularity(granularity);
  const entry = assertRegistryKey(key);

  const buckets = buildBuckets(granularity);
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  const page = await fetchModelRecordsPage(key, rangeStart, rangeEnd, pagination);
  return { key, label: entry.label, granularity, ...page };
};

const getRecentActivity = async (limit) => {
  const cacheKey = `recent:${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const docs = await fetchRecentDocsAcrossModels(limit);
  const mostRecentFirst = docs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  setCache(cacheKey, mostRecentFirst, 30000);
  return mostRecentFirst;
};

const getTotals = async () => {
  const cacheKey = 'totals:all-time';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const counts = await countAllModelsAllTime();

  const result = {
    total: sumCounts(counts),
    counts,
    netScore: computeNetScore(counts),
    directionTotals: splitCountsByDirection(counts),
    collections: listRegistryOptions(),
  };

  setCache(cacheKey, result, 120000);
  return result;
};

const getSchema = () => getSchemaMap();

const clearDashboardCache = () => {
  clearCache();
  return { cleared: true };
};

module.exports = {
  getNumbers,
  getTotals,
  getBucketedStats,
  getBreakdown,
  getRecords,
  getRecentActivity,
  getSchema,
  clearDashboardCache,
};
