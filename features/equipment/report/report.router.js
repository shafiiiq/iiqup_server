const express = require('express');
const router = express.Router();
const controller = require('./report.controller');

router.post('/', controller.createServiceReport);

router.get('/histories/:regNo/:type/:param1?/:param2?/:param3?', controller.handleHistoryQuery);
router.get('/summary/:type/:param1?/:param2?', controller.handleSummaryQuery);

router.get('/record/:id', controller.getServiceReportById);
router.put('/record/:id', controller.updateServiceReport);
router.delete('/record/:id', controller.deleteServiceReport);

router.get('/:regNo/:date', controller.getServiceReport);

module.exports = router;