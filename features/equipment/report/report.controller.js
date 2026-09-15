const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const reportService = require('./report.service');

const SERVICE_TYPE_BY_PATH_SEGMENT = {
  'all-histories': null,
  'oil-service': 'oil',
  'normal-service': 'normal',
  'tyre-service': 'tyre',
  'battery-service': 'battery',
  'major-service': 'major',
};

const parseServiceTypesQuery = (serviceTypesParam) =>
  serviceTypesParam
    ? serviceTypesParam.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

const createServiceReport = async (req, res) => {
  try {
    const result = await reportService.insertServiceReport(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] createServiceReport:', error);
    sendError(res, { ok: false, message: 'Cannot add service report', error: error.message });
  }
};

const getServiceReport = async (req, res) => {
  try {
    const { regNo, date } = req.params;
    const result = await reportService.fetchServiceReport(regNo, date);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServiceReport:', error);
    sendError(res, { ok: false, message: 'Cannot get service report', error: error.message });
  }
};

const getServiceReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportService.fetchServiceReportById(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServiceReportById:', error);
    sendError(res, { ok: false, message: 'Cannot get service report', error: error.message });
  }
};

const updateServiceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportService.updateServiceReportById(id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] updateServiceReport:', error);
    sendError(res, { ok: false, message: 'Cannot update service report', error: error.message });
  }
};

const deleteServiceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await reportService.deleteServiceReportById(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] deleteServiceReport:', error);
    sendError(res, { ok: false, message: 'Cannot remove service report', error: error.message });
  }
};

const getAllServiceHistories = async (req, res) => {
  try {
    const { regNo } = req.params;
    const serviceTypes = parseServiceTypesQuery(req.query.serviceTypes);
    const result = await reportService.fetchAllServiceHistories(regNo, serviceTypes);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getAllServiceHistories:', error);
    sendError(res, { ok: false, message: 'Cannot get all service histories', error: error.message });
  }
};

const getServicesByType = async (req, res, type) => {
  try {
    const { regNo } = req.params;
    const result = await reportService.fetchServicesByType(regNo, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error(`[report.controller] getServicesByType (${type}):`, error);
    sendError(res, { ok: false, message: `Cannot get ${type} services`, error: error.message });
  }
};

const getServicesByDateRange = async (req, res) => {
  try {
    const { regNo, startDate, endDate } = req.params;
    const result = await reportService.fetchServicesByDateRange(regNo, startDate, endDate);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServicesByDateRange:', error);
    sendError(res, { ok: false, message: 'Cannot get services by date range', error: error.message });
  }
};

const getServicesByLastMonths = async (req, res) => {
  try {
    const { regNo, monthsCount } = req.params;
    const result = await reportService.fetchServicesByLastMonths(regNo, parseInt(monthsCount, 10));
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServicesByLastMonths:', error);
    sendError(res, { ok: false, message: 'Cannot get services by last months', error: error.message });
  }
};

const getServicesByTypeAndDateRange = async (req, res) => {
  try {
    const { regNo, serviceType, startDate, endDate } = req.params;
    const serviceTypes = parseServiceTypesQuery(req.query.serviceTypes);
    const resolvedType = SERVICE_TYPE_BY_PATH_SEGMENT[serviceType] ?? null;

    const result = await reportService.fetchServicesByTypeAndDateRange(
      regNo,
      resolvedType,
      startDate,
      endDate,
      serviceTypes
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServicesByTypeAndDateRange:', error);
    sendError(res, { ok: false, message: 'Cannot get services by type and date range', error: error.message });
  }
};

const getServicesByTypeAndLastMonths = async (req, res) => {
  try {
    const { regNo, serviceType, monthsCount } = req.params;
    const serviceTypes = parseServiceTypesQuery(req.query.serviceTypes);
    const resolvedType = SERVICE_TYPE_BY_PATH_SEGMENT[serviceType] ?? null;

    const result = await reportService.fetchServicesByTypeAndLastMonths(
      regNo,
      resolvedType,
      parseInt(monthsCount, 10),
      serviceTypes
    );
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getServicesByTypeAndLastMonths:', error);
    sendError(res, { ok: false, message: 'Cannot get services by type and last months', error: error.message });
  }
};

const getAllServicesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await reportService.fetchAllServicesByDateRange(startDate, endDate);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getAllServicesByDateRange:', error);
    sendError(res, { ok: false, message: 'Cannot get services by date range', error: error.message });
  }
};

const getAllServicesByLastMonths = async (req, res) => {
  try {
    const { monthsCount } = req.params;
    const result = await reportService.fetchAllServicesByLastMonths(parseInt(monthsCount, 10));
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[report.controller] getAllServicesByLastMonths:', error);
    sendError(res, { ok: false, message: 'Cannot get services by last months', error: error.message });
  }
};

const handleSummaryQuery = async (req, res) => {
  const { type, param1, param2 } = req.params;

  if (['daily', 'yesterday', 'weekly', 'monthly', 'yearly'].includes(type)) {
    try {
      const result = await reportService.fetchServicesByPeriod(type);
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, { ok: false, message: `Cannot get ${type} services`, error: error.message });
    }
  }

  if (type === 'date-range') {
    req.params.startDate = param1;
    req.params.endDate = param2;
    return getAllServicesByDateRange(req, res);
  }

  if (type === 'last-months') {
    req.params.monthsCount = param1;
    return getAllServicesByLastMonths(req, res);
  }

  return res.status(HTTP.BAD_REQUEST).json({ ok: false, message: 'Invalid summary type' });
};

const handleHistoryQuery = async (req, res) => {
  const { type, param1, param2, param3 } = req.params;

  if (type === 'all') return getAllServiceHistories(req, res);
  if (['oil', 'normal', 'tyre', 'battery', 'major'].includes(type)) return getServicesByType(req, res, type);

  if (type === 'date-range') {
    req.params.startDate = param1;
    req.params.endDate = param2;
    return getServicesByDateRange(req, res);
  }

  if (type === 'last-months') {
    req.params.monthsCount = param1;
    return getServicesByLastMonths(req, res);
  }

  if (Object.prototype.hasOwnProperty.call(SERVICE_TYPE_BY_PATH_SEGMENT, type)) {
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

    return sendError(res, { ok: false, message: 'Missing date-range or last-months parameter' });
  }

  return sendError(res, { ok: false, message: 'Invalid history type' });
};

module.exports = {
  createServiceReport,
  getServiceReport,
  getServiceReportById,
  updateServiceReport,
  deleteServiceReport,
  getAllServiceHistories,
  getServicesByDateRange,
  getServicesByLastMonths,
  getServicesByTypeAndDateRange,
  getServicesByTypeAndLastMonths,
  getAllServicesByDateRange,
  getAllServicesByLastMonths,
  handleSummaryQuery,
  handleHistoryQuery,
};