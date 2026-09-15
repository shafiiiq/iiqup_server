const express = require('express');
const router = express.Router();

const controller = require('./staff.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const { authMiddleware } = require('#middlewares/jwt.middleware');

router.post('/', controller.addUsers);
router.get('/', authMiddleware, paginationMiddleware, controller.getUsers);
router.get('/roles', authMiddleware, controller.getUserRoles);
router.get('/tutorials', authMiddleware, controller.getTutorials);
router.post('/tutorials/complete', authMiddleware, controller.completeTutorial);
router.get('/:id', authMiddleware, controller.getUserById);
router.put('/:id', authMiddleware, controller.updateUser);
router.delete('/:id', authMiddleware, controller.deleteUser);

module.exports = router;