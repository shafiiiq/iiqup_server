const express = require('express');
const router = express.Router();

const controller = require('./operator.controller');
const { paginationMiddleware } = require('../../shared/pagination');

// ─────────────────────────────────────────────────────────────────────────────
// Operator Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get('/get-all-operators', paginationMiddleware, controller.getAllOperators);
router.get('/operators/:qatarId', controller.getOperatorByQatarId);
router.post('/create-operator', controller.createOperator);
router.post('/verify-operator', controller.verifyOperator);
router.post('/upload-profile-pic', controller.uploadProfilePic);
router.put('/update-operator/:qatarId', controller.updateOperator);
router.delete('/delete-operator/:qatarId', controller.deleteOperator);

module.exports = router;
