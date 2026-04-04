// controllers/history.controller.js
const service = require('../services/history.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = ['oil', 'normal', 'tyre', 'battery', 'major'];

const validateType = (type, res) => {
  if (!type || !VALID_TYPES.includes(type)) {
    res.status(400).json({ ok: false, message: `Invalid service type. Must be one of: ${VALID_TYPES.join(', ')}` });
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
    if (!regNo) return res.status(400).json({ ok: false, message: 'Registration number is required' });

    const result = await service.fetchServiceHistory(regNo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] getServiceHistory:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

/**
 * GET /service-history/get/:regNo/:type
 * Returns service history for a specific type and registration number.
 */
const getServiceHistoryByType = async (req, res) => {
  try {
    const { regNo, type } = req.params;
    if (!regNo) return res.status(400).json({ ok: false, message: 'Registration number is required' });
    if (!validateType(type, res)) return;

    const result = await service.fetchServiceHistoryByType(regNo, type);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] getServiceHistoryByType:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

/**
 * GET /service-history/get-by-id/:type/:id
 * Returns a single service history record by ID.
 */
const getServiceHistoryById = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id)                      return res.status(400).json({ ok: false, message: 'ID is required' });
    if (!validateType(type, res)) return;

    const result = await service.fetchServiceHistoryById(id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] getServiceHistoryById:', error);
    res.status(500).json({ ok: false, message: error.message });
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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] addServiceHistory:', error);
    res.status(500).json({ ok: false, message: error.message });
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
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] addBatchServiceHistory:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

/**
 * DELETE /service-history/delete/:type/:id
 * Deletes a service history record and its linked report.
 */
const deleteServiceHistory = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!id)                      return res.status(400).json({ ok: false, message: 'ID is required' });
    if (!validateType(type, res)) return;

    const result = await service.deleteServiceHistory(id);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] deleteServiceHistory:', error);
    res.status(500).json({ ok: false, message: error.message });
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
    if (!regNo) return res.status(400).json({ ok: false, message: 'Registration number is required' });

    const result = await service.fetchLatestFullService(regNo);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] getLatestFullService:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

/**
 * GET /service-history/full-service/notifications
 * Returns all upcoming full service notifications.
 */
const getFullServiceNotification = async (req, res) => {
  try {
    const result = await service.fetchFullServiceNotification();
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] getFullServiceNotification:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

/**
 * POST /service-history/full-service/notification
 * Creates a full service due notification for an equipment.
 */
const addNextFullService = async (req, res) => {
  try {
    const result = await service.insertFullService(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('[HistoryController] addNextFullService:', error);
    res.status(500).json({ ok: false, message: error.message });
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