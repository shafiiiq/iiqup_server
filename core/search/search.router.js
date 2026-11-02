const express = require('express');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');
const { authMiddleware } = require('#middlewares/jwt.middleware');
const { globalSearch } = require('./search.controller');

const router = express.Router();

router.get('/', authMiddleware, paginationMiddleware, globalSearch);
router.post('/', authMiddleware, paginationMiddleware, globalSearch);

module.exports = router;
