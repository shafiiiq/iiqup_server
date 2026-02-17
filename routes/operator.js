const express = require('express');
const router = express.Router();
const OperatorController = require('../controllers/operator.controller');

router.post('/create-operator', OperatorController.createOperator);
router.post('/verify-operator', OperatorController.verifyOperator);
router.post('/upload-profile-pic', OperatorController.uploadProfilePic);
router.get('/get-all-operators', OperatorController.getAllOperators);
router.get('/operators/:qatarId', OperatorController.getOperatorByQatarId);
router.put('/update-operator/:id', OperatorController.updateOperator);
router.delete('/delete-operator/:qatarId', OperatorController.deleteOperator); 

module.exports = router;