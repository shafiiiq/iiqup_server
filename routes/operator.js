const express = require('express');
const router = express.Router();
const OperatorController = require('../controllers/operarator.controller');
const { body, param } = require('express-validator');

// Create operator
router.post('/create-operator', OperatorController.createOperator);

router.post('/verify-operator', OperatorController.verifyOperator);

module.exports = router;