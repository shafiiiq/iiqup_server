const express = require('express');
const router = express.Router();
const controller = require('./mobilization.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.get('/all-mobilizations', controller.getAllMobilizations);
router.get('/mobilization-history/:equipmentId', paginationMiddleware, controller.getMobilizationHistory);
router.get('/filtered-mobilizations', controller.getFilteredMobilizations);
router.post('/mobilize-equipment', controller.mobilizeEquipment);
router.post('/demobilize-equipment', controller.demobilizeEquipment);
router.post('/add-shifts', controller.addShifts);
router.post('/change-equipment-status', controller.changeEquipmentStatus);

module.exports = router;
