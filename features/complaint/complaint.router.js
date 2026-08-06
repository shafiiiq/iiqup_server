const express = require('express');
const router = express.Router();
const controller = require('./complaint.controller')
const { paginationMiddleware } = require('../../shared/pagination');

router.post('/register',                                                           controller.registerComplaint);
router.post('/assign-mechanic/:complaintId',                                       controller.assignMechanic );
router.post('/mechanic-request/:complaintId',                                      controller.mechanicRequestItems );
router.post('/forward-to-workshop/:complaintId',                                   controller.forwardToWorkshop);
router.post('/forward-to-workshop/without-lpo/:complaintId',                       controller.forwardToWorkshopWithoutLPO);
router.post('/approve-item/without-lpo/:complaintId',                              controller.approveItemWithoutLPO);
router.post('/create-lpo/:complaintId',                                            controller.createLPOForComplaint);
router.post('/upload-lpo/:complaintId',                                            controller.uploadLPOForComplaint);
router.post('/sign/:complaintId',                                                  controller.signComplaint);
router.post('/items-available/:complaintId',                                       controller.markItemsAvailable );
router.post('/rectified/:complaintId',                                             controller.addSolution );
router.get('/user/:uniqueCode',                              paginationMiddleware, controller.getUserComplaints);
router.get('/get-complaints/:id',                                                  controller.getComplaintDetails);
router.get('/get-all-complaints',                            paginationMiddleware, controller.getAllComplaints);
router.get('/status/:status',                                paginationMiddleware, controller.getComplaintsByStatus);
router.post('/mechanic-jobs',                                paginationMiddleware, controller.getMechanicComplaints);

module.exports = router;
