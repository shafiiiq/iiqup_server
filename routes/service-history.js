var express = require('express');
var router = express.Router();
const serviceHistoryController = require('../controllers/service-history.controller')


/* GET users listing. */
router.post('/add-service-history', serviceHistoryController.addServiceHistory)
router.post('/add-maintanance-history', serviceHistoryController.addMaintananceHistory)
router.post('/add-tyre-history/', serviceHistoryController.addTyreHistory)
router.post('/add-batery-history/', serviceHistoryController.addBatteryHistory)
router.post('/add-full-service-notification/:regNo', serviceHistoryController.addNextFullService)

router.get('/get-service-history/:regNo', serviceHistoryController.getServiceHistory)
router.get('/get-maintanance-history/:regNo', serviceHistoryController.getMaintananceHistory)
router.get('/get-latest-full-service/:regNo', serviceHistoryController.getLatestFullService)
router.get('/get-full-service-notification', serviceHistoryController.getFullServiceNotification)
router.get('/get-tyre-history/:regNo', serviceHistoryController.getTyreHistory)
router.get('/get-battery-history/:regNo', serviceHistoryController.getBatteryHistory)
// router.delete('/deleteuser/:id', userController.deleteServiceReport)

router.delete('/delete-service-history/:type/:id', serviceHistoryController.deleteServiceHistory);
 
module.exports = router; 
