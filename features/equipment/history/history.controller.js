const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const service = require('./history.service');

const VALID_SERVICE_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];

const isValidServiceType = (type) => VALID_SERVICE_TYPES.includes(type);

const invalidServiceTypeMessage = () =>
  `Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`;

const parseRegNosParam = (regNos) => regNos.split(',').map((value) => value.trim()).filter(Boolean);

const getServiceHistory = async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo) return sendError(res, { ok: false, message: 'Registration number is required' });

    const result = await service.fetchServiceHistory(regNo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getServiceHistoryByType = async (req, res) => {
  try {
    const { regNo, type } = req.params;
    if (!regNo) return sendError(res, { ok: false, message: 'Registration number is required' });
    if (!isValidServiceType(type)) return sendError(res, { ok: false, message: invalidServiceTypeMessage() });

    const result = await service.fetchServiceHistoryByType(regNo, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getServiceHistoryByType:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getServiceHistoryRecord = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id) return sendError(res, { ok: false, message: 'ID is required' });
    if (!isValidServiceType(type)) return sendError(res, { ok: false, message: invalidServiceTypeMessage() });

    const result = await service.fetchServiceHistoryById(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getServiceHistoryRecord:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getServiceHistoryList = async (req, res) => {
  try {
    const { regNos, serviceType, dateFilterMode, lastMonthsCount, customStartDate, customEndDate } = req.query;
    if (!regNos) return sendError(res, { ok: false, message: 'regNos is required' });
    if (serviceType && !isValidServiceType(serviceType)) {
      return sendError(res, { ok: false, message: invalidServiceTypeMessage() });
    }

    const result = await service.fetchServiceHistoryList({
      regNos: parseRegNosParam(regNos),
      serviceType: serviceType || null,
      dateFilterMode: dateFilterMode || 'all',
      lastMonthsCount: lastMonthsCount ? parseInt(lastMonthsCount, 10) : undefined,
      customStartDate,
      customEndDate,
      pagination: req.pagination,
    });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getServiceHistoryList:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getServiceHistoryTypeCounts = async (req, res) => {
  try {
    const { regNos, dateFilterMode, lastMonthsCount, customStartDate, customEndDate } = req.query;
    if (!regNos) return sendError(res, { ok: false, message: 'regNos is required' });

    const result = await service.fetchServiceHistoryTypeCounts({
      regNos: parseRegNosParam(regNos),
      dateFilterMode: dateFilterMode || 'all',
      lastMonthsCount: lastMonthsCount ? parseInt(lastMonthsCount, 10) : undefined,
      customStartDate,
      customEndDate,
    });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getServiceHistoryTypeCounts:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const createServiceHistory = async (req, res) => {
  try {
    const { serviceType } = req.body;
    if (!isValidServiceType(serviceType)) return sendError(res, { ok: false, message: invalidServiceTypeMessage() });

    const result = await service.insertServiceHistory(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] createServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const createServiceHistoryBatch = async (req, res) => {
  try {
    const { type } = req.body;
    if (!isValidServiceType(type)) return sendError(res, { ok: false, message: invalidServiceTypeMessage() });

    const result = await service.insertBatchServiceHistory(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] createServiceHistoryBatch:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const deleteServiceHistory = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id) return sendError(res, { ok: false, message: 'ID is required' });
    if (!isValidServiceType(type)) return sendError(res, { ok: false, message: invalidServiceTypeMessage() });

    const result = await service.deleteServiceHistory(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] deleteServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getLatestFullService = async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo) return sendError(res, { ok: false, message: 'Registration number is required' });

    const result = await service.fetchLatestFullService(regNo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getLatestFullService:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const getFullServiceNotifications = async (req, res) => {
  try {
    const result = await service.fetchFullServiceNotification();
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] getFullServiceNotifications:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

const createFullServiceNotification = async (req, res) => {
  try {
    const result = await service.insertFullService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[history.controller] createFullServiceNotification:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

module.exports = {
  getServiceHistory,
  getServiceHistoryByType,
  getServiceHistoryRecord,
  getServiceHistoryList,
  getServiceHistoryTypeCounts,
  createServiceHistory,
  createServiceHistoryBatch,
  deleteServiceHistory,
  getLatestFullService,
  getFullServiceNotifications,
  createFullServiceNotification,
};