const express = require('express');
const router = express.Router();
const controller = require('./images.controller');

router.get('/equipment-images/:regNo', controller.getEquipmentImages);
router.post('/add-equipment-image', controller.addEquipmentImage);
router.post('/bulk-equipment-images', controller.getBulkEquipmentImages);
router.post('/delete-equipment-image', controller.deleteEquipmentImage);
router.post('/replace-equipment-image', controller.replaceEquipmentImage);
router.post('/reorder-equipment-images', controller.reorderEquipmentImages);

module.exports = router;
