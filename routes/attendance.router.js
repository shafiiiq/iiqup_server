const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/attendance.controller');

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Records ───────────────────────────────────────────────────────────────────
router.post('/add-attendance',      controller.storeToProcess);

// ── Live monitoring ───────────────────────────────────────────────────────────
router.get ('/get-live-attendance', controller.getLiveAttendance);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/today-attendance',     controller.getTodayAttendance);
router.get('/attendance-stats',     controller.getAttendanceStats);
router.get('/daily-report',         controller.getDailyReport);
router.get('/employee-monthly',     controller.getEmployeeMonthlyAttendance);

module.exports = router;