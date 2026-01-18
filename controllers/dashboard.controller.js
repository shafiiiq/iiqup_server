const dashboardServices = require('../services/dashboard-services');

// EXISTING CONTROLLERS (keep as is)
const getDailyUpdates = async (req, res) => {
  dashboardServices.fetchDailyUpdates()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getWeeklyUpdates = async (req, res) => {
  dashboardServices.fetchWeeklyUpdates()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getMonthlyUpdates = async (req, res) => {
  dashboardServices.fetchMonthlyUpdates()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getYearlyUpdates = async (req, res) => {
  dashboardServices.fetchYearlyUpdates()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getLast5DaysComparison = async (req, res) => {
  dashboardServices.fetchLast5DaysComparison()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getLast5MonthsComparison = async (req, res) => {
  dashboardServices.fetchLast5MonthsComparison()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getLast5YearsComparison = async (req, res) => {
  dashboardServices.fetchLast5YearsComparison()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

// NEW CONTROLLERS FOR COUNTS ONLY
const getDailyCounts = async (req, res) => {
  dashboardServices.fetchDailyCounts()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getWeeklyCounts = async (req, res) => {
  dashboardServices.fetchWeeklyCounts()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getMonthlyCounts = async (req, res) => {
  dashboardServices.fetchMonthlyCounts()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const getYearlyCounts = async (req, res) => {
  dashboardServices.fetchYearlyCounts()
    .then((result) => res.status(result.status).json(result))
    .catch((err) => res.status(err.status || 500).json({ error: err.message }));
};

const clearCache = async (req, res) => {
  const result = dashboardServices.clearCache();
  res.status(result.status).json(result);
};

module.exports = {
  getDailyUpdates,
  getWeeklyUpdates,
  getMonthlyUpdates,
  getYearlyUpdates,
  getLast5DaysComparison,
  getLast5MonthsComparison,
  getLast5YearsComparison,
  // NEW EXPORTS
  getDailyCounts,
  getWeeklyCounts,
  getMonthlyCounts,
  getYearlyCounts,
  clearCache
};