const express = require('express');
const router  = express.Router();

const controller = require('../controllers/history.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Service History Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Service ───────────────────────────────────────────────────────────────────
router.get ('/get-service-history/:regNo',                    controller.getServiceHistory);
router.get ('/get-service-history-by/:serviceType/:id',       controller.getServiceHistoryById);
router.get ('/get-latest-full-service/:regNo',                controller.getLatestFullService);
router.get ('/get-full-service-notification',                 controller.getFullServiceNotification);
router.post('/add-service-history',                           controller.addServiceHistory);
router.post('/add-full-service-notification',                 controller.addNextFullService);

// ── Maintenance ───────────────────────────────────────────────────────────────
router.get ('/get-maintenance-history/:regNo', controller.getMaintananceHistory);
router.post('/add-maintenance-history',        controller.addMaintananceHistory);

// ── Tyre ──────────────────────────────────────────────────────────────────────
router.get ('/get-tyre-history/:regNo', controller.getTyreHistory);
router.post('/add-tyre-history',        controller.addTyreHistory);

// ── Battery ───────────────────────────────────────────────────────────────────
router.get ('/get-battery-history/:regNo', controller.getBatteryHistory);
router.post('/add-batery-history',         controller.addBatteryHistory);

// ── Muti Record ───────────────────────────────────────────────────────────────────
router.post('/batch', controller.addBatchServiceHistory);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/delete-service-history/:type/:id', controller.deleteServiceHistory);

module.exports = router;