// services/fuel.controller.js
const fuelServices = require('../services/fuel.service');

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
      filters.endDate   = endDate;
    }
    if (equipmentId) {
      filters.equipmentId = equipmentId;
    }

    const result = await fuelServices.getEquipmentFuelConsumption(filters);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[FuelController] getEquipmentFuelConsumption:', error);
    res.status(error.status || 500).json({ ok: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getEquipmentFuelConsumption
};