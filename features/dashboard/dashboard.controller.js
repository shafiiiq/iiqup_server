const dashboardService = require('./dashboard.service');
const { resolvePagination } = require('./dashboard.pagination');
const { respond } = require('#shared/response/response.respond');
const HTTP = require('#shared/response/response.status');

const getNumbers = async (req, res, next) => {
  try {
    const { granularity = 'daily' } = req.query;
    const data = await dashboardService.getNumbers(granularity);
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getTotals = async (req, res, next) => {
  try {
    const data = await dashboardService.getTotals();
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getBucketedStats = async (req, res, next) => {
  try {
    const { granularity = 'daily' } = req.query;
    const data = await dashboardService.getBucketedStats(granularity);
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getBreakdown = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { field } = req.query;
    const data = await dashboardService.getBreakdown(key, field);
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getRecords = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { granularity = 'daily', page, limit } = req.query;
    const pagination = resolvePagination({ page, limit });
    const data = await dashboardService.getRecords(key, granularity, pagination);
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const data = await dashboardService.getRecentActivity(Number(limit));
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const getSchema = async (req, res, next) => {
  try {
    const data = dashboardService.getSchema();
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

const clearCache = async (req, res, next) => {
  try {
    const data = dashboardService.clearDashboardCache();
    respond(res, { status: HTTP.OK, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNumbers,
  getTotals,
  getBucketedStats,
  getBreakdown,
  getRecords,
  getRecentActivity,
  getSchema,
  clearCache,
};
