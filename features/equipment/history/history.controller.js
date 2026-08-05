const logger = require('../../../shared/logger/logger');

const HTTP = require('../../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../../shared/response/response.util');
// controllers/history.controller.js
const service = require('./history.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];

const validateType = (type, res) => {
  if (!type || !VALID_TYPES.includes(type)) {
    sendError(res, {
      ok: false,
      message: `Invalid service type. Must be one of: ${VALID_TYPES.join(', ')}`,
    });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// History Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /service-history/get/:regNo
 * Returns all service history records for an equipment (all types).
 */
const getServiceHistory = async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ ok: false, message: 'Registration number is required' });

    const result = await service.fetchServiceHistory(regNo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] getServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * GET /service-history/get/:regNo/:type
 * Returns service history for a specific type and registration number.
 */
const getServiceHistoryByType = async (req, res) => {
  try {
    const { regNo, type } = req.params;
    if (!regNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ ok: false, message: 'Registration number is required' });
    if (!validateType(type, res)) return;

    const result = await service.fetchServiceHistoryByType(regNo, type);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] getServiceHistoryByType:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * GET /service-history/get-by-id/:type/:id
 * Returns a single service history record by ID.
 */
const getServiceHistoryById = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id)
      return sendError(res, { ok: false, message: 'ID is required' });
    if (!validateType(type, res)) return;

    const result = await service.fetchServiceHistoryById(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] getServiceHistoryById:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * POST /service-history/add
 * Adds a new service history record (single).
 */
const addServiceHistory = async (req, res) => {
  try {
    const { serviceType } = req.body;
    if (!validateType(serviceType, res)) return;

    const result = await service.insertServiceHistory(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] addServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * POST /service-history/batch
 * Adds multiple service history records in one transaction.
 */
const addBatchServiceHistory = async (req, res) => {
  try {
    const { type } = req.body;
    if (!validateType(type, res)) return;

    const result = await service.insertBatchServiceHistory(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] addBatchServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * DELETE /service-history/delete/:type/:id
 * Deletes a service history record and its linked report.
 */
const deleteServiceHistory = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id)
      return sendError(res, { ok: false, message: 'ID is required' });
    if (!validateType(type, res)) return;

    const result = await service.deleteServiceHistory(id);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] deleteServiceHistory:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Service Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /service-history/full-service/latest/:regNo
 * Returns the most recent full service record for an equipment.
 */
const getLatestFullService = async (req, res) => {
  try {
    const { regNo } = req.params;
    if (!regNo)
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ ok: false, message: 'Registration number is required' });

    const result = await service.fetchLatestFullService(regNo);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] getLatestFullService:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * GET /service-history/full-service/notifications
 * Returns all upcoming full service notifications.
 */
const getFullServiceNotification = async (req, res) => {
  try {
    const result = await service.fetchFullServiceNotification();
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] getFullServiceNotification:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

/**
 * POST /service-history/full-service/notification
 * Creates a full service due notification for an equipment.
 */
const addNextFullService = async (req, res) => {
  try {
    const result = await service.insertFullService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    logger.error('[HistoryController] addNextFullService:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getServiceHistory,
  getServiceHistoryByType,
  getServiceHistoryById,
  addServiceHistory,
  addBatchServiceHistory,
  deleteServiceHistory,
  getLatestFullService,
  getFullServiceNotification,
  addNextFullService,
};
