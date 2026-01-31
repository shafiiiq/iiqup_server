var express = require('express');
var router = express.Router();
const equipmentController = require('../controllers/equipment.controller'); 

router.post('/add-equipment', equipmentController.addEquipments);
router.get('/get-equipments', equipmentController.getEquipments);
router.post('/search-equipments', equipmentController.searchEquipments);
router.get('/get-equipment/:regNo', equipmentController.getEquipmentsByReg);
router.put('/update-equipment/:regNo', equipmentController.updateEquipments);
router.put('/status-update/:regNo', equipmentController.updateStatus);
router.delete('/delete-equipment/:regNo', equipmentController.deleteEquipments);
router.post('/add-equipment-image', equipmentController.addEquipmentImage);
router.get('/equipment-images/:regNo', equipmentController.getEquipmentRegNo);
router.post('/bulk-equipment-images', equipmentController.getBulkEquipmentImages);
router.get('/equipment-count', equipmentController.getEquipmentCount);
router.get('/equipment-stats', equipmentController.getEquipmentStats);
router.get('/get-equipments-by-status', equipmentController.getEquipmentsByStatus);

module.exports = router;