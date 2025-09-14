const express = require('express');
const router = express.Router();
const fuelsController = require('../controllers/fuels.controller');

// GET /api/fuels/equipment-consumption - Get fuel consumption for all equipment
router.get('/equipment-consumption', fuelsController.getEquipmentFuelConsumption);

module.exports = router;