const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// services/fuel.controller.js
const fuelServices = require('./fuel.service');

/**
 * GET /api/fuels/equipment-consumption
 * Returns fuel consumption for all equipment, with optional date range and equipment filters.
 */
const getEquipmentFuelConsumption = async (req, res) => {
  try {
    const { startDate, endDate, equipmentId } = req.query;

    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (equipmentId) {
      filters.equipmentId = equipmentId;
    }

    const result = await fuelServices.getEquipmentFuelConsumption(filters);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[FuelController] getEquipmentFuelConsumption:', error);
    sendError(res, { ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getEquipmentFuelConsumption,
};
