var express = require('express');
var router = express.Router();
const s3Controller = require('../controllers/s3Config.controller')

router.post('/get-pre-signed-url/', s3Controller.getS3Config)

module.exports = router;
