const express = require('express');
const router = express.Router();
const OperatorController = require('../controllers/operarator.controller');
const { body, param } = require('express-validator');


router.post('/create-operator', [
  body('name').notEmpty().withMessage('Name is required'),
  body('qatarId').notEmpty().withMessage('Qatar ID is required'),
  body('id').isNumeric().withMessage('ID must be a number'),
  body('slNo').isNumeric().withMessage('SL No must be a number')
], OperatorController.createOperator);

// Verify operator
router.post('/verify-operator', [
  body('qatarId').notEmpty().withMessage('Qatar ID is required')
], OperatorController.verifyOperator);

// Upload profile picture
router.post('/upload-profile-pic', 
  [
    body('qatarId').notEmpty().withMessage('Qatar ID is required')
  ],
  OperatorController.uploadProfilePic
);

// Get all operators
router.get('/get-all-operators', OperatorController.getAllOperators);

// Get operator by Qatar ID
router.get('/operators/:qatarId', [
  param('qatarId').notEmpty().withMessage('Qatar ID is required')
], OperatorController.getOperatorByQatarId);

// Update operator
router.put('/operators/:qatarId', [
  param('qatarId').notEmpty().withMessage('Qatar ID is required')
], OperatorController.updateOperator);

module.exports = router;