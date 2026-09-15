const express = require('express');
const router = express.Router();

const controller = require('./mechanic.controller');
const { authMiddleware } = require('#middlewares/jwt.middleware');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.get('/recent-activity', authMiddleware, controller.getRecentActivity);
router.get('/attendance/:zktecoPin', paginationMiddleware, controller.getAttendance);

router.get('/', authMiddleware, controller.getMechanic);
router.get('/:id', authMiddleware, controller.getMechanicById);
router.post('/', controller.addMechanic);
router.put('/:id', controller.updateMechanic);
router.delete('/:id', controller.deleteMechanic);

router.post('/:mechanicId/assign-toolkit', controller.addToolkit);

module.exports = router;