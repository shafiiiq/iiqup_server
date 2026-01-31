var express = require('express');
var router = express.Router();
const serviceReportController = require('../controllers/service-report.controllers.js')

router.post('/add-service-report', serviceReportController.addServiceReport)
router.get('/get-report/with-id/:id', serviceReportController.getServiceReportWithId)
router.get('/:regNo/:date', serviceReportController.getServiceReport)
router.put('/updatewith/:id', serviceReportController.updateServiceReportWithId)
router.delete('/deletewith/:id', serviceReportController.removeServiceReportWithId)

router.get('/summary/daily', serviceReportController.getDailyServices)
router.get('/summary/yesterday', serviceReportController.getYesterdayServices)
router.get('/summary/weekly', serviceReportController.getWeeklyServices)
router.get('/summary/monthly', serviceReportController.getMonthlyServices)
router.get('/summary/yearly', serviceReportController.getYearlyServices)
router.get('/summary/date-range/:startDate/:endDate', serviceReportController.getAllServicesByDateRange)
router.get('/summary/last-months/:monthsCount', serviceReportController.getAllServicesByLastMonths)

router.get('/histories/:regNo', serviceReportController.getAllServiceHistories)
router.get('/histories/:regNo/oil', serviceReportController.getAllOilServices)
router.get('/histories/:regNo/maintenance', serviceReportController.getAllMaintenanceServices)
router.get('/histories/:regNo/tyre', serviceReportController.getAllTyreServices)
router.get('/histories/:regNo/battery', serviceReportController.getAllBatteryServices)
router.get('/histories/:regNo/date-range/:startDate/:endDate', serviceReportController.getServicesByDateRange)
router.get('/histories/:regNo/last-months/:monthsCount', serviceReportController.getServicesByLastMonths)



module.exports = router;