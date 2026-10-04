const express = require('express')
const controller = require('./oauth.controller')

const router = express.Router()

router.post('/:provider', controller.socialLogin)

module.exports = router