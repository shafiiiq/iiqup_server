// controllers/service-history.controller.js
const serviceHistoryServices = require('../services/history.service.js');

// ─────────────────────────────────────────────────────────────────────────────
// Service History Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-history/service
 * Adds a new service history record.
 */
const addServiceHistory = async (req, res) => {
  try {
    const result = await serviceHistoryServices.insertServiceHistory(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] addServiceHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/service/:regNo
 * Returns service history for a given registration number.
 */
const getServiceHistory = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const result = await serviceHistoryServices.fetchServiceHistory(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getServiceHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/:id/:serviceType
 * Returns a single service history record by ID and type.
 */
const getServiceHistoryById = async (req, res) => {
  try {
    const { id, serviceType } = req.params;

    if (!id || !serviceType) {
      return res.status(400).json({ success: false, message: 'id and serviceType are required' });
    }

    const result = await serviceHistoryServices.fetchServiceHistoryById(id, serviceType);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getServiceHistoryById:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /service-history/:id/:type
 * Deletes a service history record by ID and type.
 */
const deleteServiceHistory = async (req, res) => {
  try {
    const { id, type } = req.params;

    if (!id || !type) {
      return res.status(400).json({ success: false, message: 'id and type are required' });
    }

    const result = await serviceHistoryServices.deleteServiceHistory(id, type);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] deleteServiceHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance History Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-history/maintenance
 * Adds a new maintenance history record.
 */
const addMaintananceHistory = async (req, res) => {
  try {
    const result = await serviceHistoryServices.insertMaintananceHistory(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] addMaintananceHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/maintenance/:regNo
 * Returns maintenance history for a given registration number.
 */
const getMaintananceHistory = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const result = await serviceHistoryServices.fetchMaintananceHistory(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getMaintananceHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Service Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-history/full-service
 * Adds a next full service record.
 */
const addNextFullService = async (req, res) => {
  try {
    const result = await serviceHistoryServices.insertFullService(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] addNextFullService:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/full-service/:regNo
 * Returns the latest full service record for a registration number.
 */
const getLatestFullService = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const result = await serviceHistoryServices.fetchLatestFullService(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getLatestFullService:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/full-service/notifications
 * Returns all upcoming full service notifications.
 */
const getFullServiceNotification = async (req, res) => {
  try {
    const result = await serviceHistoryServices.fetchFullServiceNotification();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getFullServiceNotification:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tyre History Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-history/tyre
 * Adds a new tyre history record.
 */
const addTyreHistory = async (req, res) => {
  try {
    const result = await serviceHistoryServices.insertTyreHisory(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] addTyreHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/tyre/:regNo
 * Returns tyre history for a given registration number.
 */
const getTyreHistory = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const result = await serviceHistoryServices.fetchTyreHistory(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getTyreHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Battery History Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /service-history/battery
 * Adds a new battery history record.
 */
const addBatteryHistory = async (req, res) => {
  try {
    const result = await serviceHistoryServices.insertBatteryHistory(req.body);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] addBatteryHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /service-history/battery/:regNo
 * Returns battery history for a given registration number.
 */
const getBatteryHistory = async (req, res) => {
  try {
    const { regNo } = req.params;

    if (!regNo) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const result = await serviceHistoryServices.fetchBatteryHistory(regNo);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[ServiceHistory] getBatteryHistory:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Service
  addServiceHistory,
  getServiceHistory,
  getServiceHistoryById,
  deleteServiceHistory,
  // Maintenance
  addMaintananceHistory,
  getMaintananceHistory,
  // Full Service
  addNextFullService,
  getLatestFullService,
  getFullServiceNotification,
  // Tyre
  addTyreHistory,
  getTyreHistory,
  // Battery
  addBatteryHistory,
  getBatteryHistory,
};