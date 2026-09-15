const express = require('express');
const router = express.Router();
const controller = require('./complaint.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware');

router.post('/register', controller.registerComplaint);
router.post('/assign-mechanic/:complaintId', controller.assignMechanic);
router.post('/mechanic-request/:complaintId', controller.mechanicRequestItems);
router.post('/forward-to-workshop/:complaintId', controller.forwardToWorkshop);
router.post('/forward-to-workshop/without-purchaseorder/:complaintId', controller.forwardToWorkshopWithoutPurchaseOrder);
router.post('/approve-item/without-purchaseorder/:complaintId', controller.approveItemWithoutPurchaseOrder);
router.post('/create-purchaseorder/:complaintId', controller.createPurchaseOrderForComplaint);
router.post('/upload/:complaintId', controller.uploadPurchaseOrderForComplaint);
router.post('/sign/:complaintId', controller.signComplaint);
router.post('/items-available/:complaintId', controller.markItemsAvailable);
router.post('/rectified/:complaintId', controller.addSolution);
router.get('/user/:uniqueCode', paginationMiddleware, controller.getUserComplaints);
router.get('/get-complaints/:id', controller.getComplaintDetails);
router.get('/get-all-complaints', paginationMiddleware, controller.getAllComplaints);
router.get('/status/:status', paginationMiddleware, controller.getComplaintsByStatus);
router.post('/mechanic-jobs', paginationMiddleware, controller.getMechanicComplaints);

module.exports = router;
