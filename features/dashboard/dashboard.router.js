const express = require('express');
const controller = require('./dashboard.controller');

const router = express.Router();

router.get('/numbers', controller.getNumbers);
router.get('/totals', controller.getTotals);
router.get('/stats', controller.getBucketedStats);
router.get('/breakdown/:key', controller.getBreakdown);
router.get('/records/:key', controller.getRecords);
router.get('/recent', controller.getRecentActivity);
router.get('/schema', controller.getSchema);
router.post('/clear-cache', controller.clearCache);

module.exports = router;
