const express = require('express');
const router = express.Router();

const controller = require('./equipment.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

const imagesRouter = require('./images/images.router');
const mobilizationRouter = require('./mobilization/mobilization.router');
const replacementRouter = require('./replacement/replacement.router');
const chainRouter = require('./chain/chain.router');

router.get('/', paginationMiddleware, controller.getEquipments);
router.get('/export', controller.getEquipmentsForExport);
router.get('/count', controller.getEquipmentCount);
router.get('/stats', controller.getEquipmentStats);
router.get('/tab-counts', controller.getEquipmentTabCounts);
router.get('/records-summary', controller.getEquipmentRecordsSummary);
router.get('/status', paginationMiddleware, controller.getEquipmentsByStatus);
router.get('/sites', controller.getSites);
router.get('/site-machine-breakdown', controller.getSiteMachineBreakdown);
router.get('/by-reg/:regNo', controller.getEquipmentByRegNo);
router.post('/', controller.addEquipment);
router.post('/mark-sold', controller.markEquipmentSold);

router.use(imagesRouter);
router.use(mobilizationRouter);
router.use(replacementRouter);
router.use(chainRouter);

router.get('/:id', controller.getEquipmentsById);
router.put('/:regNo/idle-location', controller.updateIdleLocation);
router.put('/:regNo/remarks', controller.updateRemarks);
router.put('/:regNo', controller.updateEquipments);
router.delete('/:regNo', controller.deleteEquipments);

module.exports = router;