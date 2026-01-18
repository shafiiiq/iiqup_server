const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');

// EXISTING ROUTES (keep as is)
router.get('/get-daily-updates', dashboardController.getDailyUpdates);
router.get('/get-weekly-updates', dashboardController.getWeeklyUpdates);
router.get('/get-monthly-updates', dashboardController.getMonthlyUpdates);
router.get('/get-yearly-updates', dashboardController.getYearlyUpdates);
router.get('/get-last-5-days-comparison', dashboardController.getLast5DaysComparison);
router.get('/get-last-5-months-comparison', dashboardController.getLast5MonthsComparison);
router.get('/get-last-5-years-comparison', dashboardController.getLast5YearsComparison);

// NEW ROUTES FOR COUNTS ONLY (SUPER FAST!)
router.get('/get-daily-counts', dashboardController.getDailyCounts);
router.get('/get-weekly-counts', dashboardController.getWeeklyCounts);
router.get('/get-monthly-counts', dashboardController.getMonthlyCounts);
router.get('/get-yearly-counts', dashboardController.getYearlyCounts);

// Cache management
router.post('/clear-cache', dashboardController.clearCache);

module.exports = router;