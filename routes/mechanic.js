const express = require('express');
const router = express.Router();
const mechanicController = require('../controllers/mechanic.controller');
const { authMiddleware } = require('../utils/jwt');

router.post('/add-mechanic', mechanicController.addMechanic);
router.get('/get-all-mechanic', authMiddleware, mechanicController.getMechanic);
router.put('/update-mechanic/:id', mechanicController.updateMechanic);
router.delete('/delete-mechanic/:id', mechanicController.deleteMechanic);
router.post('/:mechanicId/assign-toolkit', mechanicController.addToolkit);
router.post('/:mechanicId/overtime', mechanicController.addOvertime);
router.get('/:mechanicId/monthly-overtime', mechanicController.getMechanicMonthlyOvertime);
router.get('/:mechanicId/monthly-overtime/:month/:year', mechanicController.getMechanicMonthlyOvertime);
router.get('/attendance/:zktecoPin/daily/:date', mechanicController.getDailyAttendance);
router.get('/attendance/:zktecoPin/weekly/:year/:week', mechanicController.getWeeklyAttendance);
router.get('/attendance/:zktecoPin/monthly/:year/:month', mechanicController.getMonthlyAttendance);
router.get('/attendance/:zktecoPin/yearly/:year', mechanicController.getYearlyAttendance);
router.get('/attendance/:zktecoPin/date-range', mechanicController.getAttendanceByDateRange);
router.get('/attendance/:zktecoPin/months', mechanicController.getAttendanceByMonths);
router.get('/attendance/:zktecoPin/years', mechanicController.getAttendanceByYears);
router.get('/attendance/:zktecoPin/weeks', mechanicController.getAttendanceByWeeks);
router.get('/attendance/:zktecoPin/all-months', mechanicController.getAllMonthsAttendance);
router.get('/attendance/:zktecoPin/all-years', mechanicController.getAllYearsAttendance);
router.get('/attendance/:zktecoPin/all', mechanicController.getAllAttendance);
router.post('/overtime/migrate', mechanicController.migrateOvertimeData);
router.delete('/:mechanicId/overtime/cleanup', mechanicController.cleanupMechanicOvertimeData);
router.delete('/overtime/cleanup-all', mechanicController.cleanupAllOvertimeData);

module.exports = router;