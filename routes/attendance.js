const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');

// POST - Create new attendance record
router.post('/add-attendance', attendanceController.storeToProcess);

// GET - Get live attendance data
router.get('/get-live-attendance', attendanceController.getLiveAttendance);

// GET - Get today's attendance
router.get('/today-attendance', attendanceController.getTodayAttendance);

// GET - Get attendance statistics
router.get('/attendance-stats', attendanceController.getAttendanceStats);

// GET - Get daily report
router.get('/daily-report', attendanceController.getDailyReport);

// GET - Get employee monthly attendance
router.get('/employee-monthly', attendanceController.getEmployeeMonthlyAttendance);

// POST - Manual sync with external system
router.post('/manual-sync', attendanceController.manualSync);

// GET - Get monitoring status
router.get('/monitoring-status', attendanceController.getMonitoringStatus);

// POST - Start live monitoring
router.post('/start-monitoring', attendanceController.startMonitoring);

// POST - Stop live monitoring
router.post('/stop-monitoring', attendanceController.stopMonitoring);

module.exports = router;