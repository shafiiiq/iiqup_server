const express = require('express');
const router  = express.Router();

const controller         = require('../controllers/mechanic.controller');
const { authMiddleware } = require('../utils/jwt.utils');

// ─────────────────────────────────────────────────────────────────────────────
// Mechanic Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get   ('/get-all-mechanic', authMiddleware,            controller.getMechanic);
router.post  ('/add-mechanic',                                controller.addMechanic);
router.put   ('/update-mechanic/:id',                         controller.updateMechanic);
router.delete('/delete-mechanic/:id',                         controller.deleteMechanic);

// ── Toolkit & overtime ────────────────────────────────────────────────────────
router.post('/:mechanicId/assign-toolkit',                    controller.addToolkit);
router.post('/:mechanicId/overtime',                          controller.addOvertime);
router.get ('/:mechanicId/monthly-overtime',                  controller.getMechanicMonthlyOvertime);
router.get ('/:mechanicId/monthly-overtime/:month/:year',     controller.getMechanicMonthlyOvertime);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get('/attendance/:zktecoPin/daily/:date',              controller.getDailyAttendance);
router.get('/attendance/:zktecoPin/weekly/:year/:week',       controller.getWeeklyAttendance);
router.get('/attendance/:zktecoPin/monthly/:year/:month',     controller.getMonthlyAttendance);
router.get('/attendance/:zktecoPin/yearly/:year',             controller.getYearlyAttendance);
router.get('/attendance/:zktecoPin/date-range',               controller.getAttendanceByDateRange);
router.get('/attendance/:zktecoPin/months',                   controller.getAttendanceByMonths);
router.get('/attendance/:zktecoPin/years',                    controller.getAttendanceByYears);
router.get('/attendance/:zktecoPin/weeks',                    controller.getAttendanceByWeeks);
router.get('/attendance/:zktecoPin/all-months',               controller.getAllMonthsAttendance);
router.get('/attendance/:zktecoPin/all-years',                controller.getAllYearsAttendance);
router.get('/attendance/:zktecoPin/all',                      controller.getAllAttendance);

// ── Overtime data migration & cleanup ─────────────────────────────────────────
router.post  ('/overtime/migrate',                            controller.migrateOvertimeData);
router.delete('/:mechanicId/overtime/cleanup',                controller.cleanupMechanicOvertimeData);
router.delete('/overtime/cleanup-all',                        controller.cleanupAllOvertimeData);

module.exports = router;