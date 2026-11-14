const express = require('express')
const controller = require('./dashboard.participants.controller')

const router = express.Router()

router.post('/', controller.getRecentParticipants)

module.exports = router