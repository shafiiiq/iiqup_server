const express = require('express');
const router = express.Router();
const controller = require('./activity.controller');

router.get('/activities', controller.getActivityFeed);
router.get('/activities/counts', controller.getActivityCounts);
router.get('/activities/:source/:activityId', controller.getActivityDetail);

module.exports = router;