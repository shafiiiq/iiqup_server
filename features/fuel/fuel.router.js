// ─────────────────────────────────────────────────────────────────────────────
// Fuels Router
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const fuelsController = require('./fuel.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Fuel Consumption
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/equipment-consumption',
  fuelsController.getEquipmentFuelConsumption
);

// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
