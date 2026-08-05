const logger = require('../../../shared/logger/logger');

const HTTP = require('../../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../../shared/response/response.util');
// controllers/report.controller.js
const reportServices = require('./report.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps URL path segments to their canonical serviceType values.
 * 'all-histories' maps to null (no type filter — return all types).
 */
const SERVICE_TYPE_MAP = {
  'all-histories': null,
  'oil-service': 'oil',
  'normal-service': 'normal',
  'tyre-service': 'tyre',
  'battery-service': 'battery',
  'major-service': 'major',
};

const parseServiceTypes = (serviceTypesParam) =>
  serviceTypesParam
    ? serviceTypesParam
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

// ─────────────────────────────────────────────────────────────────────────────
// Service Report CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-report/add-service-report
 * Adds a new service report.
 */
const addServiceReport = async (req, res) => {
  try {
    const result = await reportServices.insertServiceReport(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] addServiceReport:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot add service report',
      error: error.message,
    });
  }
};

/**
 * GET /service-report/:regNo/:date
 * Returns service report(s) by registration number and date.
 */
const getServiceReport = async (req, res) => {
  try {
    const { regNo, date } = req.params;
    const result = await reportServices.fetchServiceReport(regNo, date);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServiceReport:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get service report',
      error: error.message,
    });
  }
};

/**
 * GET /service-report/get-report/with-id/:id
 * Returns a service report by ID.
 */
const getServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportServices.fetchServiceReportWith(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServiceReportWithId:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get service report',
      error: error.message,
    });
  }
};

/**
 * PUT /service-report/updatewith/:id
 * Updates a service report by ID and syncs its linked history record.
 */
const updateServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportServices.updateServiceReportWith(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] updateServiceReportWithId:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot update service report',
      error: error.message,
    });
  }
};

/**
 * DELETE /service-report/deletewith/:id
 * Deletes a service report and its linked history record.
 */
const removeServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportServices.deleteServiceReportWith(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] removeServiceReportWithId:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot remove service report',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// History Query Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all service reports for a registration number (all types).
 */
const getAllServiceHistories = async (req, res) => {
  try {
    const { regNo } = req.params;
    const serviceTypes = parseServiceTypes(req.query.serviceTypes);
    const result = await reportServices.fetchAllServiceHistories(
      regNo,
      serviceTypes
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getAllServiceHistories:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get all service histories',
      error: error.message,
    });
  }
};

/**
 * Returns all service reports for a registration number filtered by a single type.
 * Used by the individual type dispatch cases in handleHistory.
 */
const getServicesByType = async (req, res, type) => {
  try {
    const { regNo } = req.params;
    const result = await reportServices.fetchServicesByType(regNo, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error(`[ReportController] getServicesByType (${type}):`, error);
    sendError(res, {
      ok: false,
      message: `Cannot get ${type} services`,
      error: error.message,
    });
  }
};

/**
 * Returns service reports for a registration number within a date range.
 */
const getServicesByDateRange = async (req, res) => {
  try {
    const { regNo, startDate, endDate } = req.params;
    const result = await reportServices.fetchServicesByDateRange(
      regNo,
      startDate,
      endDate
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServicesByDateRange:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by date range',
      error: error.message,
    });
  }
};

/**
 * Returns service reports for a registration number from the last N months.
 */
const getServicesByLastMonths = async (req, res) => {
  try {
    const { regNo, monthsCount } = req.params;
    const result = await reportServices.fetchServicesByLastMonths(
      regNo,
      parseInt(monthsCount)
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServicesByLastMonths:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by last months',
      error: error.message,
    });
  }
};

/**
 * Returns service reports filtered by type and date range.
 */
const getServicesByTypeAndDateRange = async (req, res) => {
  try {
    const { regNo, serviceType, startDate, endDate } = req.params;
    const serviceTypes = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType] ?? null;

    const result = await reportServices.fetchServicesByTypeAndDateRange(
      regNo,
      actualServiceType,
      startDate,
      endDate,
      serviceTypes
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServicesByTypeAndDateRange:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by type and date range',
      error: error.message,
    });
  }
};

/**
 * Returns service reports filtered by type from the last N months.
 */
const getServicesByTypeAndLastMonths = async (req, res) => {
  try {
    const { regNo, serviceType, monthsCount } = req.params;
    const serviceTypes = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType] ?? null;

    const result = await reportServices.fetchServicesByTypeAndLastMonths(
      regNo,
      actualServiceType,
      parseInt(monthsCount),
      serviceTypes
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getServicesByTypeAndLastMonths:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by type and last months',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Period Summary Controllers
// ─────────────────────────────────────────────────────────────────────────────

const getAllServicesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await reportServices.fetchAllServicesByDateRange(
      startDate,
      endDate
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getAllServicesByDateRange:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by date range',
      error: error.message,
    });
  }
};

const getAllServicesByLastMonths = async (req, res) => {
  try {
    const { monthsCount } = req.params;
    const result = await reportServices.fetchAllServicesByLastMonths(
      parseInt(monthsCount)
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[ReportController] getAllServicesByLastMonths:', error);
    sendError(res, {
      ok: false,
      message: 'Cannot get services by last months',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /service-report/summary/:type/:param1?/:param2?
 * Routes summary requests by period keyword or date range.
 */
const handleSummary = async (req, res) => {
  const { type, param1, param2 } = req.params;

  switch (type) {
    case 'daily':
    case 'yesterday':
    case 'weekly':
    case 'monthly':
    case 'yearly': {
      try {
        const result = await reportServices.fetchServicesByPeriod(type);
        return sendSuccess(res, result);
      } catch (error) {
        return sendError(res, {
          ok: false,
          message: `Cannot get ${type} services`,
          error: error.message,
        });
      }
    }
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate = param2;
      return getAllServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getAllServicesByLastMonths(req, res);
    default:
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ ok: false, message: 'Invalid summary type' });
  }
};

/**
 * GET /service-report/histories/:regNo/:type/:param1?/:param2?/:param3?
 * Routes history requests by type keyword, date range, or last-months.
 */
const handleHistory = async (req, res) => {
  const { type, param1, param2, param3 } = req.params;

  // ── Single-type shortcuts ──────────────────────────────────────────────────
  if (type === 'all') return getAllServiceHistories(req, res);
  if (type === 'oil') return getServicesByType(req, res, 'oil');
  if (type === 'normal') return getServicesByType(req, res, 'normal');
  if (type === 'tyre') return getServicesByType(req, res, 'tyre');
  if (type === 'battery') return getServicesByType(req, res, 'battery');
  if (type === 'major') return getServicesByType(req, res, 'major');

  // ── Untyped date range / last-months ─────────────────────────────────────
  if (type === 'date-range') {
    req.params.startDate = param1;
    req.params.endDate = param2;
    return getServicesByDateRange(req, res);
  }
  if (type === 'last-months') {
    req.params.monthsCount = param1;
    return getServicesByLastMonths(req, res);
  }

  // ── Typed date range / last-months  (e.g. /histories/123/oil-service/date-range/…) ──
  if (SERVICE_TYPE_MAP.hasOwnProperty(type)) {
    req.params.serviceType = type;
    if (param1 === 'date-range') {
      req.params.startDate = param2;
      req.params.endDate = param3;
      return getServicesByTypeAndDateRange(req, res);
    }
    if (param1 === 'last-months') {
      req.params.monthsCount = param2;
      return getServicesByTypeAndLastMonths(req, res);
    }
    return sendError(res, {
      ok: false,
      message: 'Missing date-range or last-months parameter',
    });
  }

  return sendError(res, { ok: false, message: 'Invalid history type' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addServiceReport,
  getServiceReport,
  getServiceReportWithId,
  updateServiceReportWithId,
  removeServiceReportWithId,
  // History Queries
  getAllServiceHistories,
  getServicesByDateRange,
  getServicesByLastMonths,
  getServicesByTypeAndDateRange,
  getServicesByTypeAndLastMonths,
  // Period Summaries
  getAllServicesByDateRange,
  getAllServicesByLastMonths,
  // Dispatch
  handleSummary,
  handleHistory,
};
