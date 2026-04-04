// routes/history.routes.js
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/history.controller');

// ── Unified history ───────────────────────────────────────────────────────────
router.get ('/get/:regNo',           controller.getServiceHistory);
router.get ('/get/:regNo/:type',     controller.getServiceHistoryByType);
router.get ('/get-by-id/:type/:id',  controller.getServiceHistoryById);
router.post('/add',                  controller.addServiceHistory);
router.post('/batch',                controller.addBatchServiceHistory);
router.delete('/delete/:type/:id',   controller.deleteServiceHistory);

// ── Full service ──────────────────────────────────────────────────────────────
router.get ('/full-service/latest/:regNo',  controller.getLatestFullService);
router.get ('/full-service/notifications',  controller.getFullServiceNotification);
router.post('/full-service/notification',   controller.addNextFullService);

module.exports = router;