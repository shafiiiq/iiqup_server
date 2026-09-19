const express = require('express');
const router = express.Router();
const controller = require('./idle-roster.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.get('/idle-roster', controller.getLatestRoster);
router.get('/idle-roster/history', paginationMiddleware, controller.getRosterHistory);
router.get('/idle-roster/:id', controller.getRosterById);
router.post('/idle-roster/save', controller.saveRosterUpdate);

module.exports = router;