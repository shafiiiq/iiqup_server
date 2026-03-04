// controllers/service-report.controller.js
const reportServices = require('../services/report.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_TYPE_MAP = {
  'all-histories':        null,
  'oil-service':          'oil',
  'maintenance-service':  'maintenance',
  'tyre-service':         'tyre',
  'battery-service':      'battery',
};

const parseServiceTypes = (serviceTypesParam) =>
  serviceTypesParam ? serviceTypesParam.split(',').map(t => t.trim()) : [];

// ─────────────────────────────────────────────────────────────────────────────
// Service Report CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /add-service-report
 * Adds a new service report.
 */
const addServiceReport = async (req, res) => {
  try {
    const result = await reportServices.insertServiceReport(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] addServiceReport:', error);
    res.status(error.status || 500).json({ message: 'Cannot add service report', error: error.message });
  }
};

/**
 * GET /:regNo/:date
 * Returns a service report by registration number and date.
 */
const getServiceReport = async (req, res) => {
  try {
    const { regNo, date } = req.params;

    const result = await reportServices.fetchServiceReport(regNo, date);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServiceReport:', error);
    res.status(error.status || 500).json({ message: 'Cannot get service report', error: error.message });
  }
};

/**
 * GET /get-report/with-id/:id
 * Returns a service report by ID.
 */
const getServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reportServices.fetchServiceReportWith(id);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServiceReportWithId:', error);
    res.status(error.status || 500).json({ message: 'Cannot get service report', error: error.message });
  }
};

/**
 * PUT /updatewith/:id
 * Updates a service report by ID.
 */
const updateServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reportServices.updateServiceReportWith(id, req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] updateServiceReportWithId:', error);
    res.status(error.status || 500).json({ message: 'Cannot update service report', error: error.message });
  }
};

/**
 * DELETE /deletewith/:id
 * Deletes a service report by ID.
 */
const removeServiceReportWithId = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reportServices.deleteServiceReportWith(id);

    res.status(200).json(result);
  } catch (error) {
    console.error('[ServiceReport] removeServiceReportWithId:', error);
    res.status(error.status || 500).json({ message: 'Cannot remove service report', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// History Query Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /histories/:regNo/all
 * Returns all service histories for a registration number.
 */
const getAllServiceHistories = async (req, res) => {
  try {
    const { regNo }    = req.params;
    const serviceTypes = parseServiceTypes(req.query.serviceTypes);

    const result = await reportServices.fetchAllServiceHistories(regNo, serviceTypes);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllServiceHistories:', error);
    res.status(error.status || 500).json({ message: 'Cannot get all service histories', error: error.message });
  }
};

/**
 * GET /histories/:regNo/oil
 * Returns all oil service records for a registration number.
 */
const getAllOilServices = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await reportServices.fetchServicesByType(regNo, 'oil');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllOilServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get oil services', error: error.message });
  }
};

/**
 * GET /histories/:regNo/maintenance
 * Returns all maintenance service records for a registration number.
 */
const getAllMaintenanceServices = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await reportServices.fetchServicesByType(regNo, 'maintenance');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllMaintenanceServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get maintenance services', error: error.message });
  }
};

/**
 * GET /histories/:regNo/tyre
 * Returns all tyre service records for a registration number.
 */
const getAllTyreServices = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await reportServices.fetchServicesByType(regNo, 'tyre');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllTyreServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get tyre services', error: error.message });
  }
};

/**
 * GET /histories/:regNo/battery
 * Returns all battery service records for a registration number.
 */
const getAllBatteryServices = async (req, res) => {
  try {
    const { regNo } = req.params;
    const result    = await reportServices.fetchServicesByType(regNo, 'battery');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllBatteryServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get battery services', error: error.message });
  }
};

/**
 * GET /histories/:regNo/date-range/:startDate/:endDate
 * Returns service records within a date range for a registration number.
 */
const getServicesByDateRange = async (req, res) => {
  try {
    const { regNo, startDate, endDate } = req.params;
    const result = await reportServices.fetchServicesByDateRange(regNo, startDate, endDate);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServicesByDateRange:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by date range', error: error.message });
  }
};

/**
 * GET /histories/:regNo/last-months/:monthsCount
 * Returns service records from the last N months for a registration number.
 */
const getServicesByLastMonths = async (req, res) => {
  try {
    const { regNo, monthsCount } = req.params;
    const result = await reportServices.fetchServicesByLastMonths(regNo, parseInt(monthsCount));

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServicesByLastMonths:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by last months', error: error.message });
  }
};

/**
 * GET /histories/:regNo/:serviceType/date-range/:startDate/:endDate
 * Returns service records filtered by type and date range.
 */
const getServicesByTypeAndDateRange = async (req, res) => {
  try {
    const { regNo, serviceType, startDate, endDate } = req.params;
    const serviceTypes      = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType];

    const result = await reportServices.fetchServicesByTypeAndDateRange(
      regNo, actualServiceType, startDate, endDate, serviceTypes
    );

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServicesByTypeAndDateRange:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by type and date range', error: error.message });
  }
};

/**
 * GET /histories/:regNo/:serviceType/last-months/:monthsCount
 * Returns service records filtered by type from the last N months.
 */
const getServicesByTypeAndLastMonths = async (req, res) => {
  try {
    const { regNo, serviceType, monthsCount } = req.params;
    const serviceTypes      = parseServiceTypes(req.query.serviceTypes);
    const actualServiceType = SERVICE_TYPE_MAP[serviceType];

    const result = await reportServices.fetchServicesByTypeAndLastMonths(
      regNo, actualServiceType, parseInt(monthsCount), serviceTypes
    );

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getServicesByTypeAndLastMonths:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by type and last months', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Period Summary Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /summary/daily
 */
const getDailyServices = async (req, res) => {
  try {
    const result = await reportServices.fetchServicesByPeriod('daily');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getDailyServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get daily services', error: error.message });
  }
};

/**
 * GET /summary/yesterday
 */
const getYesterdayServices = async (req, res) => {
  try {
    const result = await reportServices.fetchServicesByPeriod('yesterday');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getYesterdayServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get yesterday services', error: error.message });
  }
};

/**
 * GET /summary/weekly
 */
const getWeeklyServices = async (req, res) => {
  try {
    const result = await reportServices.fetchServicesByPeriod('weekly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getWeeklyServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get weekly services', error: error.message });
  }
};

/**
 * GET /summary/monthly
 */
const getMonthlyServices = async (req, res) => {
  try {
    const result = await reportServices.fetchServicesByPeriod('monthly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getMonthlyServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get monthly services', error: error.message });
  }
};

/**
 * GET /summary/yearly
 */
const getYearlyServices = async (req, res) => {
  try {
    const result = await reportServices.fetchServicesByPeriod('yearly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getYearlyServices:', error);
    res.status(error.status || 500).json({ message: 'Cannot get yearly services', error: error.message });
  }
};

/**
 * GET /summary/date-range/:startDate/:endDate
 */
const getAllServicesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await reportServices.fetchAllServicesByDateRange(startDate, endDate);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllServicesByDateRange:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by date range', error: error.message });
  }
};

/**
 * GET /summary/last-months/:monthsCount
 */
const getAllServicesByLastMonths = async (req, res) => {
  try {
    const { monthsCount } = req.params;
    const result = await reportServices.fetchAllServicesByLastMonths(parseInt(monthsCount));

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceReport] getAllServicesByLastMonths:', error);
    res.status(error.status || 500).json({ message: 'Cannot get services by last months', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /summary/:type/:param1?/:param2?
 * Dispatches summary requests by period type or date range.
 */
const handleSummary = async (req, res) => {
  const { type, param1, param2 } = req.params;

  switch (type) {
    case 'daily':      return getDailyServices(req, res);
    case 'yesterday':  return getYesterdayServices(req, res);
    case 'weekly':     return getWeeklyServices(req, res);
    case 'monthly':    return getMonthlyServices(req, res);
    case 'yearly':     return getYearlyServices(req, res);
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate   = param2;
      return getAllServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getAllServicesByLastMonths(req, res);
    default:
      return res.status(400).json({ message: 'Invalid summary type' });
  }
};

/**
 * GET /histories/:regNo/:type/:param1?/:param2?/:param3?
 * Dispatches history requests by service type, date range, or last months.
 */
const handleHistory = async (req, res) => {
  const { type, param1, param2, param3 } = req.params;

  switch (type) {
    case 'all':         return getAllServiceHistories(req, res);
    case 'oil':         return getAllOilServices(req, res);
    case 'maintenance': return getAllMaintenanceServices(req, res);
    case 'tyre':        return getAllTyreServices(req, res);
    case 'battery':     return getAllBatteryServices(req, res);
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate   = param2;
      return getServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getServicesByLastMonths(req, res);
    case 'oil-service':
    case 'maintenance-service':
    case 'tyre-service':
    case 'battery-service':
    case 'all-histories':
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
      return res.status(400).json({ message: 'Invalid history parameters' });
    default:
      return res.status(400).json({ message: 'Invalid history type' });
  }
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
  getAllOilServices,
  getAllMaintenanceServices,
  getAllTyreServices,
  getAllBatteryServices,
  getServicesByDateRange,
  getServicesByLastMonths,
  getServicesByTypeAndDateRange,
  getServicesByTypeAndLastMonths,
  // Period Summaries
  getDailyServices,
  getYesterdayServices,
  getWeeklyServices,
  getMonthlyServices,
  getYearlyServices,
  getAllServicesByDateRange,
  getAllServicesByLastMonths,
  // Dispatch
  handleSummary,
  handleHistory,
};