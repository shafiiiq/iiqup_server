const express = require('express');
const router = express.Router();
const controller = require('./images.controller');

router.get('/equipment-images/:regNo', controller.getEquipmentImages);
router.post('/add-equipment-image', controller.addEquipmentImage);
router.post('/bulk-equipment-images', controller.getBulkEquipmentImages);

module.exports = router;
