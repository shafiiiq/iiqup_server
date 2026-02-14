var express = require('express');
var router = express.Router();
const equipmentController = require('../controllers/equipment.controller');

router.post('/add-equipment', equipmentController.addEquipments);
router.get('/get-equipments', equipmentController.getEquipments);
router.post('/search-equipments', equipmentController.searchEquipments);
router.get('/get-equipment/:regNo', equipmentController.getEquipmentsByReg);
router.put('/update-equipment/:regNo', equipmentController.updateEquipments);
router.put('/status-update/:id', equipmentController.updateStatus);
router.delete('/delete-equipment/:regNo', equipmentController.deleteEquipments);
router.post('/add-equipment-image', equipmentController.addEquipmentImage);
router.get('/equipment-images/:regNo', equipmentController.getEquipmentRegNo);
router.post('/bulk-equipment-images', equipmentController.getBulkEquipmentImages);
router.get('/equipment-count', equipmentController.getEquipmentCount);
router.get('/equipment-stats', equipmentController.getEquipmentStats);
router.get('/get-equipments-by-status', equipmentController.getEquipmentsByStatus);
router.post('/change-equipment-status', equipmentController.changeEquipmentStatus);

router.post('/mobilize-equipment', equipmentController.mobilizeEquipment);
router.post('/demobilize-equipment', equipmentController.demobilizeEquipment);
router.get('/mobilization-history/:equipmentId', equipmentController.getMobilizationHistory);
router.get('/get-sites', equipmentController.getSites);
router.post('/replace-operator', equipmentController.replaceOperator);
router.post('/replace-equipment', equipmentController.replaceEquipment);
router.get('/replacement-history/:equipmentId', equipmentController.getReplacementHistory);
router.get('/all-mobilizations', equipmentController.getAllMobilizations);
router.get('/all-replacements', equipmentController.getAllReplacements);

router.get('/filtered-mobilizations', equipmentController.getFilteredMobilizations);
router.get('/filtered-replacements', equipmentController.getFilteredReplacements);

module.exports = router;