const express = require('express')
const controller = require('./directory.controller')
const { authMiddleware } = require('#middlewares/jwt.middleware')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')

const router = express.Router()

router.get('/', authMiddleware, paginationMiddleware, controller.getDirectoryUsers)

module.exports = router