const dashboardServices = require('../services/dashboard.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a dashboard service call in a standard async handler.
 *
 * @param {Function} serviceFn - The dashboard service function to call.
 * @returns {Function} Express route handler.
 */
const handle = (serviceFn) => async (req, res) => {
  try {
    const result = await serviceFn();
    res.status(result.status).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

// ── Full updates ──────────────────────────────────────────────────────────────
const getDailyUpdates          = handle(dashboardServices.fetchDailyUpdates);
const getWeeklyUpdates         = handle(dashboardServices.fetchWeeklyUpdates);
const getMonthlyUpdates        = handle(dashboardServices.fetchMonthlyUpdates);
const getYearlyUpdates         = handle(dashboardServices.fetchYearlyUpdates);
const getLast5DaysComparison   = handle(dashboardServices.fetchLast5DaysComparison);
const getLast5MonthsComparison = handle(dashboardServices.fetchLast5MonthsComparison);
const getLast5YearsComparison  = handle(dashboardServices.fetchLast5YearsComparison);

// ── Counts only ───────────────────────────────────────────────────────────────
const getDailyCounts           = handle(dashboardServices.fetchDailyCounts);
const getWeeklyCounts          = handle(dashboardServices.fetchWeeklyCounts);
const getMonthlyCounts         = handle(dashboardServices.fetchMonthlyCounts);
const getYearlyCounts          = handle(dashboardServices.fetchYearlyCounts);

// ── Cache ─────────────────────────────────────────────────────────────────────

/**
 * POST /clear-cache
 * Clears the dashboard service cache.
 */
const clearCache = (req, res) => {
  const result = dashboardServices.clearCache();
  res.status(result.status).json(result);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getDailyUpdates,
  getWeeklyUpdates,
  getMonthlyUpdates,
  getYearlyUpdates,
  getLast5DaysComparison,
  getLast5MonthsComparison,
  getLast5YearsComparison,
  getDailyCounts,
  getWeeklyCounts,
  getMonthlyCounts,
  getYearlyCounts,
  clearCache,
};