const express = require('express')
const controller = require('./s3.controller')

const router = express.Router()

router.post('/pre-signed-url', controller.retrivePresignedUrl)

module.exports = router