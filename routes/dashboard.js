const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

/**
 * Routes for dashboard updates
 */
router.get('/get-daily-updates', dashboardController.getDailyUpdates);
router.get('/get-weekly-updates', dashboardController.getWeeklyUpdates);
router.get('/get-monthly-updates', dashboardController.getMonthlyUpdates);
router.get('/get-yearly-updates', dashboardController.getYearlyUpdates);
router.get('/get-all-updates', dashboardController.getAllUpdates);
 
module.exports = router;