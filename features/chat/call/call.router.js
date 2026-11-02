const express = require('express');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const controller = require('./call.controller');

const router = express.Router();

router.get('/calls/history', paginationMiddleware, controller.getCallHistory);
router.post('/calls/record', controller.saveCallRecord);

module.exports = router;