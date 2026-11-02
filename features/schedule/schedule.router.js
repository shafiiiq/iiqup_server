const express = require('express');
const controller = require('./schedule.controller');

const router = express.Router();

router.get('/', controller.listSchedules);
router.get('/counts', controller.countSchedules);
router.get('/assignees', controller.searchAssignees);
router.post('/', controller.createSchedule);

module.exports = router;