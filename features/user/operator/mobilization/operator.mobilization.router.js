const express = require('express');
const router = express.Router();
const controller = require('./operator.mobilization.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.get('/all-mobilizations', controller.getAllOperatorMobilizations);
router.get('/mobilization-history/:operatorId', paginationMiddleware, controller.getOperatorMobilizationHistory);
router.post('/mobilize-operator', controller.mobilizeOperator);
router.post('/demobilize-operator', controller.demobilizeOperator);
router.post('/replace-operator', controller.replaceOperator);

module.exports = router;