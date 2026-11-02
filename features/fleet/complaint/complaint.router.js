const express = require('express');
const router = express.Router();
const controller = require('./complaint.controller');
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.post('/register', controller.registerComplaint);
router.post('/rectified/:complaintId', controller.addSolution);
router.get('/user/:uniqueCode', paginationMiddleware, controller.getUserComplaints);
router.get('/equipment-latest', paginationMiddleware, controller.getEquipmentLatestComplaints);
router.get('/equipment/:regNo', paginationMiddleware, controller.getEquipmentComplaints);
router.get('/get-complaints/:id', controller.getComplaintDetails);
router.get('/get-all-complaints', paginationMiddleware, controller.getAllComplaints);

module.exports = router;