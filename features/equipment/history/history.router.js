const express = require('express');
const router = express.Router();
const controller = require('./history.controller');

router.get('/get/:regNo', controller.getServiceHistory);
router.get('/get/:regNo/:type', controller.getServiceHistoryByType);
router.get('/get-by-id/:type/:id', controller.getServiceHistoryById);
router.post('/add', controller.addServiceHistory);
router.post('/batch', controller.addBatchServiceHistory);
router.delete('/delete/:type/:id', controller.deleteServiceHistory);
router.get('/full-service/latest/:regNo', controller.getLatestFullService);
router.get('/full-service/notifications', controller.getFullServiceNotification);
router.post('/full-service/notification', controller.addNextFullService);

module.exports = router;
