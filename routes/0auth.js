var express = require('express');
var router = express.Router();
const _0authController = require('../controllers/0auth.controller')

router.post('/refresh', _0authController.verifyRefresh);

module.exports = router;
