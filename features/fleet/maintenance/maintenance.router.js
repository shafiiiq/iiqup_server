const express = require('express');
const controller = require('./maintenance.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

require('./maintenance.signature.registration');

const router = express.Router();
router.post('/', controller.createMaintenance);

router.get('/list', paginationMiddleware, controller.getMaintenanceList);
router.get('/type-counts', controller.getMaintenanceTypeCounts);
router.get('/documents', controller.getMaintenanceDocuments);
router.get('/pdf/download/:id', controller.downloadMaintenancePdf);

router.get('/full-service/latest/:regNo', controller.getLatestFullService);
router.get('/full-service/notifications', controller.getFullServiceNotifications);

router.get('/equipment/:regNo/:serviceType?', controller.getMaintenanceByRegNo);

router.get('/:id', controller.getMaintenanceById);
router.put('/:id', controller.updateMaintenance);
router.delete('/:id', controller.deleteMaintenance);

module.exports = router;