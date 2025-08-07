const dashboardServices = require('../services/dashboard-services');

/**
 * Controller to fetch daily updates
 */
const getDailyUpdates = async (req, res) => {
  dashboardServices.fetchDailyUpdates()
    .then((result) => {
      res.status(result.status).json(result);
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

/**
 * Controller to fetch weekly updates
 */
const getWeeklyUpdates = async (req, res) => {
  dashboardServices.fetchWeeklyUpdates(req.body)
    .then((result) => {
      res.status(result.status).json(result);
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

/**
 * Controller to fetch monthly updates
 */
const getMonthlyUpdates = async (req, res) => {
  dashboardServices.fetchMonthlyUpdates(req.body)
    .then((result) => {
      res.status(result.status).json(result);
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

/**
 * Controller to fetch yearly updates
 */
const getYearlyUpdates = async (req, res) => {
  dashboardServices.fetchYearlyUpdates(req.body)
    .then((result) => {
      res.status(result.status).json(result);
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

/**
 * Controller to fetch all updates at once
 */
const getAllUpdates = async (req, res) => {
  dashboardServices.fetchAllUpdates(req.body)
    .then((result) => {
      res.status(result.status).json(result);
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message });
    });
};

module.exports = {
  getDailyUpdates,
  getWeeklyUpdates,
  getMonthlyUpdates,
  getYearlyUpdates,
  getAllUpdates
};