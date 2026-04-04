// controllers/report.controller.js
const reportServices = require('../services/report.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps URL path segments to their canonical serviceType values.
 * 'all-histories' maps to null (no type filter — return all types).
 */
const SERVICE_TYPE_MAP = {
  'all-histories':    null,
  'oil-service':      'oil',
  'normal-service':   'normal',
  'tyre-service':     'tyre',
  'battery-service':  'battery',
  'major-service':    'major',
};

const parseServiceTypes = (serviceTypesParam) =>
  serviceTypesParam ? serviceTypesParam.split(',').map(t => t.trim()).filter(Boolean) : [];

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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] addServiceReport:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot add service report', error: error.message });
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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServiceReport:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get service report', error: error.message });
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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServiceReportWithId:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get service report', error: error.message });
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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] updateServiceReportWithId:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot update service report', error: error.message });
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
    res.status(200).json(result);
  } catch (error) {
    console.error('[ReportController] removeServiceReportWithId:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot remove service report', error: error.message });
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
    const { regNo }    = req.params;
    const serviceTypes = parseServiceTypes(req.query.serviceTypes);
    const result       = await reportServices.fetchAllServiceHistories(regNo, serviceTypes);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getAllServiceHistories:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get all service histories', error: error.message });
  }
};

/**
 * Returns all service reports for a registration number filtered by a single type.
 * Used by the individual type dispatch cases in handleHistory.
 */
const getServicesByType = async (req, res, type) => {
  try {
    const { regNo } = req.params;
    const result    = await reportServices.fetchServicesByType(regNo, type);
    res.status(result.status).json(result);
  } catch (error) {
    console.error(`[ReportController] getServicesByType (${type}):`, error);
    res.status(error.status || 500).json({ ok: false, message: `Cannot get ${type} services`, error: error.message });
  }
};

/**
 * Returns service reports for a registration number within a date range.
 */
const getServicesByDateRange = async (req, res) => {
  try {
    const { regNo, startDate, endDate } = req.params;
    const result = await reportServices.fetchServicesByDateRange(regNo, startDate, endDate);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServicesByDateRange:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by date range', error: error.message });
  }
};

/**
 * Returns service reports for a registration number from the last N months.
 */
const getServicesByLastMonths = async (req, res) => {
  try {
    const { regNo, monthsCount } = req.params;
    const result = await reportServices.fetchServicesByLastMonths(regNo, parseInt(monthsCount));
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServicesByLastMonths:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by last months', error: error.message });
  }
};

/**
 * Returns service reports filtered by type and date range.
 */
const getServicesByTypeAndDateRange = async (req, res) => {
  try {
    const { regNo, serviceType, startDate, endDate } = req.params;
    const serviceTypes      = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType] ?? null;

    const result = await reportServices.fetchServicesByTypeAndDateRange(
      regNo, actualServiceType, startDate, endDate, serviceTypes
    );
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServicesByTypeAndDateRange:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by type and date range', error: error.message });
  }
};

/**
 * Returns service reports filtered by type from the last N months.
 */
const getServicesByTypeAndLastMonths = async (req, res) => {
  try {
    const { regNo, serviceType, monthsCount } = req.params;
    const serviceTypes      = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType] ?? null;

    const result = await reportServices.fetchServicesByTypeAndLastMonths(
      regNo, actualServiceType, parseInt(monthsCount), serviceTypes
    );
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getServicesByTypeAndLastMonths:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by type and last months', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Period Summary Controllers
// ─────────────────────────────────────────────────────────────────────────────

const getAllServicesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await reportServices.fetchAllServicesByDateRange(startDate, endDate);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getAllServicesByDateRange:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by date range', error: error.message });
  }
};

const getAllServicesByLastMonths = async (req, res) => {
  try {
    const { monthsCount } = req.params;
    const result = await reportServices.fetchAllServicesByLastMonths(parseInt(monthsCount));
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ReportController] getAllServicesByLastMonths:', error);
    res.status(error.status || 500).json({ ok: false, message: 'Cannot get services by last months', error: error.message });
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
        return res.status(result.status).json(result);
      } catch (error) {
        return res.status(error.status || 500).json({ ok: false, message: `Cannot get ${type} services`, error: error.message });
      }
    }
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate   = param2;
      return getAllServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getAllServicesByLastMonths(req, res);
    default:
      return res.status(400).json({ ok: false, message: 'Invalid summary type' });
  }
};

/**
 * GET /service-report/histories/:regNo/:type/:param1?/:param2?/:param3?
 * Routes history requests by type keyword, date range, or last-months.
 */
const handleHistory = async (req, res) => {
  const { type, param1, param2, param3 } = req.params;

  // ── Single-type shortcuts ──────────────────────────────────────────────────
  if (type === 'all')    return getAllServiceHistories(req, res);
  if (type === 'oil')    return getServicesByType(req, res, 'oil');
  if (type === 'normal') return getServicesByType(req, res, 'normal');
  if (type === 'tyre')   return getServicesByType(req, res, 'tyre');
  if (type === 'battery')return getServicesByType(req, res, 'battery');
  if (type === 'major')  return getServicesByType(req, res, 'major');

  // ── Untyped date range / last-months ─────────────────────────────────────
  if (type === 'date-range') {
    req.params.startDate = param1;
    req.params.endDate   = param2;
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
      req.params.endDate   = param3;
      return getServicesByTypeAndDateRange(req, res);
    }
    if (param1 === 'last-months') {
      req.params.monthsCount = param2;
      return getServicesByTypeAndLastMonths(req, res);
    }
    return res.status(400).json({ ok: false, message: 'Missing date-range or last-months parameter' });
  }

  return res.status(400).json({ ok: false, message: 'Invalid history type' });
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