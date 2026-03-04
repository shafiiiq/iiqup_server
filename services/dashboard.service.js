const serviceHistoryModel    = require('../models/history.model.js');
const serviceReportModel     = require('../models/report.model.js');
const maintananceHistoryModel = require('../models/maintenance.model.js');
const tyreModel              = require('../models/tyre.model.js');
const batteryModel           = require('../models/battery.model.js');
const stocksModel            = require('../models/stock.model.js');
const equipmnentModel        = require('../models/equipment.model.js');
const toolkitModel           = require('../models/toolkit.model.js');
const complaintModel         = require('../models/complaint.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

const cache = {
  data: {},

  set: (key, value, ttl = 300000) => {
    cache.data[key] = { value, expires: Date.now() + ttl };
  },

  get: (key) => {
    const item = cache.data[key];
    if (!item) return null;
    if (Date.now() > item.expires) {
      delete cache.data[key];
      return null;
    }
    return item.value;
  },

  clear: () => { cache.data = {}; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const models = [
  { model: serviceHistoryModel,    source: 'serviceHistoryModel',    content: 'service-history'    },
  { model: serviceReportModel,     source: 'serviceReportModel',     content: 'service-report'     },
  { model: maintananceHistoryModel, source: 'maintananceHistoryModel', content: 'maintenance-history' },
  { model: tyreModel,              source: 'tyreModel',              content: 'tyre-history'       },
  { model: batteryModel,           source: 'batteryModel',           content: 'battery-history'    },
  { model: equipmnentModel,        source: 'equipmnentModel',        content: 'equipment'          },
  { model: stocksModel,            source: 'stocksModel',            content: 'stocks'             },
  { model: toolkitModel,           source: 'toolkitModel',           content: 'toolkit'            },
  { model: complaintModel,         source: 'complaintModel',         content: 'complaints'         }
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a date range query for createdAt / updatedAt fields.
 * @param {Date}      startDate
 * @param {Date|null} endDate
 * @returns {object}
 */
const buildDateQuery = (startDate, endDate = null) => {
  const range = endDate
    ? { $gte: startDate, $lte: endDate }
    : { $gte: startDate };

  return { $or: [{ createdAt: range }, { updatedAt: range }] };
};

/**
 * Shapes a collection-keyed object from an array of { [content]: count } items.
 * @param {object[]} countsArray
 * @returns {object}
 */
const mergeCountsArray = (countsArray) => {
  const result = {};
  countsArray.forEach(item => Object.assign(result, item));
  return result;
};

/**
 * Sums all values in a counts object.
 * @param {object} counts
 * @returns {number}
 */
const sumCounts = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);

/**
 * Builds the standard update-list payload shared by all *Updates methods.
 * @param {object} updatesByCollection
 * @param {object} counts
 * @returns {object}
 */
const buildUpdatesPayload = (updatesByCollection, counts) => ({
  serviceHistory:     updatesByCollection['service-history']    || [],
  serviceReports:     updatesByCollection['service-report']     || [],
  maintenanceHistory: updatesByCollection['maintenance-history'] || [],
  tyreHistory:        updatesByCollection['tyre-history']       || [],
  batteryHistory:     updatesByCollection['battery-history']    || [],
  equipment:          updatesByCollection['equipment']          || [],
  stocks:             updatesByCollection['stocks']             || [],
  toolkit:            updatesByCollection['toolkit']            || [],
  complaints:         updatesByCollection['complaints']         || [],
  counts,
  total: sumCounts(counts)
});

/**
 * Returns document counts per collection for the given date range.
 * @param {Date}      startDate
 * @param {Date|null} endDate
 * @returns {Promise<object>}
 */
const getCountsForPeriod = async (startDate, endDate = null) => {
  const query = buildDateQuery(startDate, endDate);

  const countsArray = await Promise.all(
    models.map(async ({ model, content }) => ({
      [content]: await model.countDocuments(query)
    }))
  );

  return mergeCountsArray(countsArray);
};

/**
 * Returns the most recent documents per collection since startDate.
 * @param {Date}   startDate
 * @param {number} limit     Maximum documents per collection.
 * @returns {Promise<object>}
 */
const getLimitedDataForPeriod = async (startDate, limit = 50) => {
  const query                = buildDateQuery(startDate);
  const updatesByCollection  = {};

  await Promise.all(
    models.map(async ({ model, content }) => {
      const docs = await model
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      updatesByCollection[content] = docs.map(doc => ({ ...doc, source: model.modelName, content }));
    })
  );

  return updatesByCollection;
};

// ─────────────────────────────────────────────────────────────────────────────
// Counts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns document counts for all collections created/updated today.
 * @returns {Promise<object>}
 */
const fetchDailyCounts = async () => {
  try {
    const cacheKey = 'daily-counts';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const counts     = await getCountsForPeriod(todayStart);
    const result     = { status: 200, data: { counts, total: sumCounts(counts) } };

    cache.set(cacheKey, result, 60000); // 1 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchDailyCounts:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns document counts for all collections created/updated in the last 7 days.
 * @returns {Promise<object>}
 */
const fetchWeeklyCounts = async () => {
  try {
    const cacheKey  = 'weekly-counts';
    const cached    = cache.get(cacheKey);
    if (cached) return cached;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const counts = await getCountsForPeriod(oneWeekAgo);
    const result = { status: 200, data: { counts, total: sumCounts(counts) } };

    cache.set(cacheKey, result, 120000); // 2 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchWeeklyCounts:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns document counts for all collections created/updated in the last 30 days.
 * @returns {Promise<object>}
 */
const fetchMonthlyCounts = async () => {
  try {
    const cacheKey   = 'monthly-counts';
    const cached     = cache.get(cacheKey);
    if (cached) return cached;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const counts = await getCountsForPeriod(oneMonthAgo);
    const result = { status: 200, data: { counts, total: sumCounts(counts) } };

    cache.set(cacheKey, result, 300000); // 5 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchMonthlyCounts:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns document counts for all collections created/updated in the last 365 days.
 * @returns {Promise<object>}
 */
const fetchYearlyCounts = async () => {
  try {
    const cacheKey  = 'yearly-counts';
    const cached    = cache.get(cacheKey);
    if (cached) return cached;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const counts = await getCountsForPeriod(oneYearAgo);
    const result = { status: 200, data: { counts, total: sumCounts(counts) } };

    cache.set(cacheKey, result, 600000); // 10 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchYearlyCounts:', error);
    return { status: 500, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns counts and the 50 most-recent documents per collection for today.
 * @returns {Promise<object>}
 */
const fetchDailyUpdates = async () => {
  try {
    const cacheKey = 'daily-updates';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const counts             = await getCountsForPeriod(todayStart);
    const updatesByCollection = await getLimitedDataForPeriod(todayStart, 50);
    const result             = { status: 200, data: buildUpdatesPayload(updatesByCollection, counts) };

    cache.set(cacheKey, result, 60000); // 1 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchDailyUpdates:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns counts and the 50 most-recent documents per collection for the last 7 days.
 * @returns {Promise<object>}
 */
const fetchWeeklyUpdates = async () => {
  try {
    const cacheKey = 'weekly-updates';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const counts              = await getCountsForPeriod(oneWeekAgo);
    const updatesByCollection = await getLimitedDataForPeriod(oneWeekAgo, 50);
    const result              = { status: 200, data: buildUpdatesPayload(updatesByCollection, counts) };

    cache.set(cacheKey, result, 120000); // 2 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchWeeklyUpdates:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns counts and the 100 most-recent documents per collection for the last 30 days.
 * @returns {Promise<object>}
 */
const fetchMonthlyUpdates = async () => {
  try {
    const cacheKey = 'monthly-updates';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const counts              = await getCountsForPeriod(oneMonthAgo);
    const updatesByCollection = await getLimitedDataForPeriod(oneMonthAgo, 100);
    const result              = { status: 200, data: buildUpdatesPayload(updatesByCollection, counts) };

    cache.set(cacheKey, result, 300000); // 5 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchMonthlyUpdates:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns counts and the 200 most-recent documents per collection for the last 365 days.
 * @returns {Promise<object>}
 */
const fetchYearlyUpdates = async () => {
  try {
    const cacheKey = 'yearly-updates';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const counts              = await getCountsForPeriod(oneYearAgo);
    const updatesByCollection = await getLimitedDataForPeriod(oneYearAgo, 200);
    const result              = { status: 200, data: buildUpdatesPayload(updatesByCollection, counts) };

    cache.set(cacheKey, result, 600000); // 10 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchYearlyUpdates:', error);
    return { status: 500, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Comparisons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns per-day document counts for the last 5 days.
 * @returns {Promise<object>}
 */
const fetchLast5DaysComparison = async () => {
  try {
    const cacheKey = 'comparison-5-days';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now            = new Date();
    const comparisonData = [];

    for (let i = 0; i < 5; i++) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const counts = await getCountsForPeriod(dayStart, dayEnd);
      comparisonData.push({
        date:        dayStart.toISOString().split('T')[0],
        collections: counts,
        total:       sumCounts(counts)
      });
    }

    const result = { status: 200, data: { period: 'last-5-days', comparison: comparisonData.reverse() } };

    cache.set(cacheKey, result, 300000); // 5 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchLast5DaysComparison:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns per-month document counts for the last 5 months.
 * @returns {Promise<object>}
 */
const fetchLast5MonthsComparison = async () => {
  try {
    const cacheKey = 'comparison-5-months';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now            = new Date();
    const comparisonData = [];

    for (let i = 0; i < 5; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const counts = await getCountsForPeriod(monthStart, monthEnd);
      comparisonData.push({
        month:       monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
        collections: counts,
        total:       sumCounts(counts)
      });
    }

    const result = { status: 200, data: { period: 'last-5-months', comparison: comparisonData.reverse() } };

    cache.set(cacheKey, result, 600000); // 10 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchLast5MonthsComparison:', error);
    return { status: 500, message: error.message };
  }
};

/**
 * Returns per-year document counts for the last 5 years.
 * @returns {Promise<object>}
 */
const fetchLast5YearsComparison = async () => {
  try {
    const cacheKey = 'comparison-5-years';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now            = new Date();
    const comparisonData = [];

    for (let i = 0; i < 5; i++) {
      const yearStart = new Date(now.getFullYear() - i, 0, 1);
      const yearEnd   = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);

      const counts = await getCountsForPeriod(yearStart, yearEnd);
      comparisonData.push({
        year:        yearStart.getFullYear(),
        collections: counts,
        total:       sumCounts(counts)
      });
    }

    const result = { status: 200, data: { period: 'last-5-years', comparison: comparisonData.reverse() } };

    cache.set(cacheKey, result, 1800000); // 30 min
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchLast5YearsComparison:', error);
    return { status: 500, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clears the entire in-memory cache. Call after any write operation.
 * @returns {object}
 */
const clearCache = () => {
  cache.clear();
  return { status: 200, message: 'Cache cleared successfully' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  fetchDailyCounts,
  fetchWeeklyCounts,
  fetchMonthlyCounts,
  fetchYearlyCounts,
  fetchDailyUpdates,
  fetchWeeklyUpdates,
  fetchMonthlyUpdates,
  fetchYearlyUpdates,
  fetchLast5DaysComparison,
  fetchLast5MonthsComparison,
  fetchLast5YearsComparison,
  clearCache
};