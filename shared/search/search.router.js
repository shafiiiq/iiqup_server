const express = require('express');
const paginationMiddleware = require('../pagination/pagination.middleware');
const { globalSearch } = require('./search.controller');

const router = express.Router();

router.get('/', paginationMiddleware, globalSearch);
router.post('/', paginationMiddleware, globalSearch);

module.exports = router;
