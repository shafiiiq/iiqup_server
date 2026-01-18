const serviceHistoryModel = require('../models/service-history.model.js');
const serviceReportModel = require('../models/service-report.model.js');
const maintananceHistoryModel = require('../models/maintanance-history.model.js');
const tyreModel = require('../models/tyre.model.js');
const batteryModel = require('../models/batery.model.js');
const stocksModel = require('../models/stocks.model.js');
const equipmnentModel = require('../models/equip.model.js');
const toolkitModel = require('../models/toolkit.model.js');
const complaintModel = require('../models/complaint.model.js');

// Simple in-memory cache
const cache = {
  data: {},
  set: (key, value, ttl = 300000) => { // 5 min default
    cache.data[key] = {
      value,
      expires: Date.now() + ttl
    };
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
  clear: () => {
    cache.data = {};
  }
};

// Define all models with their source names
const models = [
  { model: serviceHistoryModel, source: 'serviceHistoryModel', content: 'service-history' },
  { model: serviceReportModel, source: 'serviceReportModel', content: 'service-report' },
  { model: maintananceHistoryModel, source: 'maintananceHistoryModel', content: 'maintanance-history' },
  { model: tyreModel, source: 'tyreModel', content: 'tyre-history' },
  { model: batteryModel, source: 'batteryModel', content: 'battery-history' },
  { model: equipmnentModel, source: 'equipmnentModel', content: 'equipment' },
  { model: stocksModel, source: 'stocksModel', content: 'stocks' },
  { model: toolkitModel, source: 'toolkitModel', content: 'toolkit' },
  { model: complaintModel, source: 'complaintModel', content: 'complaints' }
];

/**
 * Helper: Get counts only (FAST!)
 */
const getCountsForPeriod = async (startDate, endDate = null) => {
  const query = endDate
    ? {
      $or: [
        { createdAt: { $gte: startDate, $lte: endDate } },
        { updatedAt: { $gte: startDate, $lte: endDate } }
      ]
    }
    : {
      $or: [
        { createdAt: { $gte: startDate } },
        { updatedAt: { $gte: startDate } }
      ]
    };

  const counts = await Promise.all(
    models.map(async ({ model, content }) => ({
      [content]: await model.countDocuments(query)
    }))
  );

  const result = {};
  counts.forEach(item => Object.assign(result, item));
  return result;
};

/**
 * Helper: Get limited data (for tables/charts)
 */
const getLimitedDataForPeriod = async (startDate, limit = 50) => {
  const updatesByCollection = {};

  await Promise.all(
    models.map(async ({ model, content }) => {
      const docs = await model
        .find({
          $or: [
            { createdAt: { $gte: startDate } },
            { updatedAt: { $gte: startDate } }
          ]
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      updatesByCollection[content] = docs.map(doc => ({
        ...doc,
        source: model.modelName,
        content
      }));
    })
  );

  return updatesByCollection;
};

module.exports = {
  /**
   * OPTIMIZED: Fetch daily counts only
   */
  fetchDailyCounts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'daily-counts';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const counts = await getCountsForPeriod(todayStart);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

        const result = {
          status: 200,
          data: { counts, total }
        };

        cache.set(cacheKey, result, 60000); // Cache 1 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching daily counts:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch weekly counts only
   */
  fetchWeeklyCounts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'weekly-counts';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);

        const counts = await getCountsForPeriod(oneWeekAgo);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

        const result = {
          status: 200,
          data: { counts, total }
        };

        cache.set(cacheKey, result, 120000); // Cache 2 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching weekly counts:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch monthly counts only
   */
  fetchMonthlyCounts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'monthly-counts';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);

        const counts = await getCountsForPeriod(oneMonthAgo);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

        const result = {
          status: 200,
          data: { counts, total }
        };

        cache.set(cacheKey, result, 300000); // Cache 5 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching monthly counts:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch yearly counts only
   */
  fetchYearlyCounts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'yearly-counts';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const counts = await getCountsForPeriod(oneYearAgo);
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

        const result = {
          status: 200,
          data: { counts, total }
        };

        cache.set(cacheKey, result, 600000); // Cache 10 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching yearly counts:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch daily updates with limited data
   */
  fetchDailyUpdates: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'daily-updates';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get counts (fast)
        const counts = await getCountsForPeriod(todayStart);

        // Get limited data for display (50 most recent per collection)
        const updatesByCollection = await getLimitedDataForPeriod(todayStart, 50);

        const result = {
          status: 200,
          data: {
            serviceHistory: updatesByCollection['service-history'] || [],
            serviceReports: updatesByCollection['service-report'] || [],
            maintenanceHistory: updatesByCollection['maintanance-history'] || [],
            tyreHistory: updatesByCollection['tyre-history'] || [],
            batteryHistory: updatesByCollection['battery-history'] || [],
            equipment: updatesByCollection['equipment'] || [],
            stocks: updatesByCollection['stocks'] || [],
            toolkit: updatesByCollection['toolkit'] || [],
            complaints: updatesByCollection['complaints'] || [],
            counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          }
        };

        cache.set(cacheKey, result, 60000); // Cache 1 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching daily updates:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch weekly updates with limited data
   */
  fetchWeeklyUpdates: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'weekly-updates';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);

        const counts = await getCountsForPeriod(oneWeekAgo);
        const updatesByCollection = await getLimitedDataForPeriod(oneWeekAgo, 50);

        const result = {
          status: 200,
          data: {
            serviceHistory: updatesByCollection['service-history'] || [],
            serviceReports: updatesByCollection['service-report'] || [],
            maintenanceHistory: updatesByCollection['maintanance-history'] || [],
            tyreHistory: updatesByCollection['tyre-history'] || [],
            batteryHistory: updatesByCollection['battery-history'] || [],
            equipment: updatesByCollection['equipment'] || [],
            stocks: updatesByCollection['stocks'] || [],
            toolkit: updatesByCollection['toolkit'] || [],
            complaints: updatesByCollection['complaints'] || [],
            counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          }
        };

        cache.set(cacheKey, result, 120000); // Cache 2 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching weekly updates:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch monthly updates with limited data
   */
  fetchMonthlyUpdates: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'monthly-updates';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);

        const counts = await getCountsForPeriod(oneMonthAgo);
        const updatesByCollection = await getLimitedDataForPeriod(oneMonthAgo, 100);

        const result = {
          status: 200,
          data: {
            serviceHistory: updatesByCollection['service-history'] || [],
            serviceReports: updatesByCollection['service-report'] || [],
            maintenanceHistory: updatesByCollection['maintanance-history'] || [],
            tyreHistory: updatesByCollection['tyre-history'] || [],
            batteryHistory: updatesByCollection['battery-history'] || [],
            equipment: updatesByCollection['equipment'] || [],
            stocks: updatesByCollection['stocks'] || [],
            toolkit: updatesByCollection['toolkit'] || [],
            complaints: updatesByCollection['complaints'] || [],
            counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          }
        };

        cache.set(cacheKey, result, 300000); // Cache 5 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching monthly updates:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * OPTIMIZED: Fetch yearly updates with limited data
   */
  fetchYearlyUpdates: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'yearly-updates';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const counts = await getCountsForPeriod(oneYearAgo);
        const updatesByCollection = await getLimitedDataForPeriod(oneYearAgo, 200);

        const result = {
          status: 200,
          data: {
            serviceHistory: updatesByCollection['service-history'] || [],
            serviceReports: updatesByCollection['service-report'] || [],
            maintenanceHistory: updatesByCollection['maintanance-history'] || [],
            tyreHistory: updatesByCollection['tyre-history'] || [],
            batteryHistory: updatesByCollection['battery-history'] || [],
            equipment: updatesByCollection['equipment'] || [],
            stocks: updatesByCollection['stocks'] || [],
            toolkit: updatesByCollection['toolkit'] || [],
            complaints: updatesByCollection['complaints'] || [],
            counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          }
        };

        cache.set(cacheKey, result, 600000); // Cache 10 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching yearly updates:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * Fetch last 5 days comparison (ALREADY OPTIMIZED - uses countDocuments)
   */
  fetchLast5DaysComparison: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'comparison-5-days';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const comparisonData = [];

        for (let i = 0; i < 5; i++) {
          const dayStart = new Date(now);
          dayStart.setDate(now.getDate() - i);
          dayStart.setHours(0, 0, 0, 0);

          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);

          const counts = await getCountsForPeriod(dayStart, dayEnd);

          comparisonData.push({
            date: dayStart.toISOString().split('T')[0],
            collections: counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          });
        }

        const result = {
          status: 200,
          data: {
            period: 'last-5-days',
            comparison: comparisonData.reverse()
          }
        };

        cache.set(cacheKey, result, 300000); // Cache 5 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching last 5 days comparison:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * Fetch last 5 months comparison (ALREADY OPTIMIZED)
   */
  fetchLast5MonthsComparison: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'comparison-5-months';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const comparisonData = [];

        for (let i = 0; i < 5; i++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

          const counts = await getCountsForPeriod(monthStart, monthEnd);

          comparisonData.push({
            month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
            collections: counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          });
        }

        const result = {
          status: 200,
          data: {
            period: 'last-5-months',
            comparison: comparisonData.reverse()
          }
        };

        cache.set(cacheKey, result, 600000); // Cache 10 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching last 5 months comparison:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * Fetch last 5 years comparison (ALREADY OPTIMIZED)
   */
  fetchLast5YearsComparison: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const cacheKey = 'comparison-5-years';
        const cached = cache.get(cacheKey);
        if (cached) return resolve(cached);

        const now = new Date();
        const comparisonData = [];

        for (let i = 0; i < 5; i++) {
          const yearStart = new Date(now.getFullYear() - i, 0, 1);
          const yearEnd = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);

          const counts = await getCountsForPeriod(yearStart, yearEnd);

          comparisonData.push({
            year: yearStart.getFullYear(),
            collections: counts,
            total: Object.values(counts).reduce((sum, count) => sum + count, 0)
          });
        }

        const result = {
          status: 200,
          data: {
            period: 'last-5-years',
            comparison: comparisonData.reverse()
          }
        };

        cache.set(cacheKey, result, 1800000); // Cache 30 min
        resolve(result);
      } catch (err) {
        console.error('Error fetching last 5 years comparison:', err);
        reject({ status: 500, message: err.message });
      }
    });
  },

  /**
   * Clear all caches (call this when new data is added)
   */
  clearCache: () => {
    cache.clear();
    return { status: 200, message: 'Cache cleared successfully' };
  }
};