var express = require('express');
var router = express.Router();
const serviceHistoryController = require('../controllers/service-history.controller')


/* GET users listing. */
router.post('/add-service-history', serviceHistoryController.addServiceHistory)
router.post('/add-maintanance-history', serviceHistoryController.addMaintananceHistory)
router.get('/get-service-history/:regNo', serviceHistoryController.getServiceHistory)
router.get('/get-maintanance-history/:regNo', serviceHistoryController.getMaintananceHistory)
router.get('/get-latest-full-service/:regNo', serviceHistoryController.getLatestFullService)
router.post('/add-full-service-notification/:regNo', serviceHistoryController.addNextFullService)
router.get('/get-full-service-notification', serviceHistoryController.getFullServiceNotification)
router.post('/add-tyre-history/', serviceHistoryController.addTyreHistory)
router.get('/get-tyre-history/:regNo', serviceHistoryController.getTyreHistory)
router.post('/add-batery-history/', serviceHistoryController.addBatteryHistory)
router.get('/get-battery-history/:regNo', serviceHistoryController.getBatteryHistory)
// router.delete('/deleteuser/:id', userController.deleteServiceReport)
 
module.exports = router; 
