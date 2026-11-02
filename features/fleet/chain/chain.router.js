const express = require('express');
const router = express.Router();
const controller = require('./chain.controller');

router.get('/chain/by-equipment/:regNo', controller.getChainByRegNo);
router.get('/chain/:chainId', controller.getChainById);

module.exports = router;