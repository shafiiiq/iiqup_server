const express = require('express');
const router = express.Router();
const controller = require('./replacement.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.get('/all-replacements', controller.getAllReplacements);
router.get('/replacement-history/:equipmentId', paginationMiddleware, controller.getReplacementHistory);
router.get('/filtered-replacements', controller.getFilteredReplacements);
router.post('/replace-operator', controller.replaceOperator);
router.post('/replace-equipment', controller.replaceEquipment);

module.exports = router;
