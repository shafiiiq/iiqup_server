var express = require('express');
var router = express.Router();
const serviceReportController = require('../controllers/service-report.controllers.js')

router.post('/add-service-report', serviceReportController.addServiceReport)
router.get('/get-report/with-id/:id', serviceReportController.getServiceReportWithId)
router.put('/updatewith/:id', serviceReportController.updateServiceReportWithId)
router.delete('/deletewith/:id', serviceReportController.removeServiceReportWithId)

router.get('/histories/:regNo/:type/:param1?/:param2?/:param3?', serviceReportController.handleHistory)
router.get('/summary/:type/:param1?/:param2?', serviceReportController.handleSummary)
router.get('/:regNo/:date', serviceReportController.getServiceReport)

module.exports = router;