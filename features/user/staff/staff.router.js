const express = require('express');
const router = express.Router();

const controller = require('./staff.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const { authMiddleware } = require('#middlewares/jwt.middleware');
const { requireRoles } = require('#middlewares/role.middleware');
const { USER_ROLES } = require('./staff.constant');

const userAdminOnly = requireRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.SUB_ADMIN);

router.post('/', authMiddleware, userAdminOnly, controller.addUsers);
router.get('/', authMiddleware, paginationMiddleware, controller.getUsers);
router.get('/roles', authMiddleware, controller.getUserRoles);
router.get('/tutorials', authMiddleware, controller.getTutorials);
router.post('/tutorials/complete', authMiddleware, controller.completeTutorial);
router.get('/:id', authMiddleware, controller.getUserById);
router.put('/:id', authMiddleware, userAdminOnly, controller.updateUser);
router.delete('/:id', authMiddleware, userAdminOnly, controller.deleteUser);

module.exports = router;