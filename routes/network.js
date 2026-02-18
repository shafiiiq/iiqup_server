const express = require('express');
const router = express.Router();
const networkController = require('../controllers/network.controllers');

router.post('/speedtest', networkController.speedtest);
  
module.exports = router;