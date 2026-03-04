const express = require('express');
const router  = express.Router();

const controller = require('../controllers/dashboard.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Full updates ──────────────────────────────────────────────────────────────
router.get('/get-daily-updates',             controller.getDailyUpdates);
router.get('/get-weekly-updates',            controller.getWeeklyUpdates);
router.get('/get-monthly-updates',           controller.getMonthlyUpdates);
router.get('/get-yearly-updates',            controller.getYearlyUpdates);
router.get('/get-last-5-days-comparison',    controller.getLast5DaysComparison);
router.get('/get-last-5-months-comparison',  controller.getLast5MonthsComparison);
router.get('/get-last-5-years-comparison',   controller.getLast5YearsComparison);

// ── Counts only ───────────────────────────────────────────────────────────────
router.get('/get-daily-counts',              controller.getDailyCounts);
router.get('/get-weekly-counts',             controller.getWeeklyCounts);
router.get('/get-monthly-counts',            controller.getMonthlyCounts);
router.get('/get-yearly-counts',             controller.getYearlyCounts);

// ── Cache ─────────────────────────────────────────────────────────────────────
router.post('/clear-cache',                  controller.clearCache);

module.exports = router;