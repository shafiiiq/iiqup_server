const express = require('express');
const router = express.Router();
const controller = require('./history.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.post('/', controller.createServiceHistory);
router.post('/batch', controller.createServiceHistoryBatch);

router.get('/full-service/latest/:regNo', controller.getLatestFullService);
router.get('/full-service/notifications', controller.getFullServiceNotifications);
router.post('/full-service/notifications', controller.createFullServiceNotification);

router.get('/list', paginationMiddleware, controller.getServiceHistoryList);
router.get('/type-counts', controller.getServiceHistoryTypeCounts);

router.get('/record/:type/:id', controller.getServiceHistoryRecord);
router.delete('/:type/:id', controller.deleteServiceHistory);

router.get('/:regNo/:type', controller.getServiceHistoryByType);
router.get('/:regNo', controller.getServiceHistory);

module.exports = router;