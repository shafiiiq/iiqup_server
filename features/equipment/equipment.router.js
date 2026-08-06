const express = require('express');
const router = express.Router();

const controller = require('./equipment.controller');
const { paginationMiddleware } = require('../../shared/pagination');

// ─────────────────────────────────────────────────────────────────────────────
// Equipment Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/get-equipments', paginationMiddleware, controller.getEquipments);
router.get('/get-equipment/:regNo', controller.getEquipmentsByReg);
router.get('/equipment-count', controller.getEquipmentCount);
router.get('/equipment-stats', controller.getEquipmentStats);
router.get(
  '/get-equipments-by-status',
  paginationMiddleware,
  controller.getEquipmentsByStatus
);
router.post('/add-equipment', controller.addEquipment);
router.post('/search-equipments', paginationMiddleware, controller.searchEquipments);
router.put('/update-equipment/:regNo', controller.updateEquipments);
router.put('/status-update/:id', controller.updateStatus);
router.delete('/delete-equipment/:regNo', controller.deleteEquipments);

// ── Images ────────────────────────────────────────────────────────────────────
router.get('/equipment-images/:regNo', controller.getEquipmentImages);
router.post('/add-equipment-image', controller.addEquipmentImage);
router.post('/bulk-equipment-images', controller.getBulkEquipmentImages);

// ── Status ────────────────────────────────────────────────────────────────────
router.post('/change-equipment-status', controller.changeEquipmentStatus);

// ── Mobilization ──────────────────────────────────────────────────────────────
router.get('/all-mobilizations', controller.getAllMobilizations);
router.get(
  '/mobilization-history/:equipmentId',
  paginationMiddleware,
  controller.getMobilizationHistory
);
router.get('/filtered-mobilizations', controller.getFilteredMobilizations);
router.get('/get-sites', controller.getSites);
router.post('/mobilize-equipment', controller.mobilizeEquipment);
router.post('/demobilize-equipment', controller.demobilizeEquipment);
router.post('/add-shifts', controller.addShifts);

// ── Replacements ──────────────────────────────────────────────────────────────
router.get('/all-replacements', controller.getAllReplacements);
router.get(
  '/replacement-history/:equipmentId',
  paginationMiddleware,
  controller.getReplacementHistory
);
router.get('/filtered-replacements', controller.getFilteredReplacements);
router.post('/replace-operator', controller.replaceOperator);
router.post('/replace-equipment', controller.replaceEquipment);

module.exports = router;
