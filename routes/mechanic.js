const express = require('express');
const router = express.Router();
const mechanicController = require('../controllers/mechanic.controller');
const { authMiddleware } = require('../utils/jwt');

/* Mechanic CRUD operations */
router.post('/add-mechanic', mechanicController.addMechanic);
router.get('/get-all-mechanic', authMiddleware, mechanicController.getMechanic);
router.put('/update-mechanic/:id', mechanicController.updateMechanic);
router.delete('/delete-mechanic/:id', mechanicController.deleteMechanic);

/* Toolkit operations */
router.post('/:mechanicId/assign-toolkit', mechanicController.addToolkit);

/* Overtime operations */
router.post('/:mechanicId/overtime', mechanicController.addOvertime);
router.get('/:mechanicId/monthly-overtime', mechanicController.getMechanicMonthlyOvertime);
router.get('/:mechanicId/monthly-overtime/:month/:year', mechanicController.getMechanicMonthlyOvertime);

/* Migration operation (one-time use) */
router.post('/overtime/migrate', mechanicController.migrateOvertimeData);

/* Cleanup operations */
router.delete('/:mechanicId/overtime/cleanup', mechanicController.cleanupMechanicOvertimeData);
router.delete('/overtime/cleanup-all', mechanicController.cleanupAllOvertimeData);

module.exports = router;