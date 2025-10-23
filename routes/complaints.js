const express = require('express');
const router = express.Router();
const ComplaintController = require('../controllers/complaint.controller');

// Step 1: Register a new complaint (unchanged but now notifies only MAINTENANCE_HEAD)
router.post('/register', ComplaintController.registerComplaint);

// Step 2: MAINTENANCE_HEAD assigns mechanic  
router.post('/assign-mechanic/:complaintId', ComplaintController.assignMechanic);
 
// Step 3: Mechanic requests items/tools
router.post('/mechanic-request/:complaintId', ComplaintController.mechanicRequestItems);

// Step 4: MAINTENANCE_HEAD forwards to WORKSHOP_MANAGER
router.post('/forward-to-workshop/:complaintId', ComplaintController.forwardToWorkshop);

// Step 5: WORKSHOP_MANAGER creates LPO
router.post('/create-lpo/:complaintId', ComplaintController.createLPOForComplaint);

router.post('/upload-lpo/:complaintId', ComplaintController.uploadLPOForComplaint);

router.post('/purchase-approval/:complaintId', ComplaintController.purchaseApproval);

router.post('/accounts-approval/:complaintId', ComplaintController.accountsApproval);

router.post('/manager-approval/:complaintId', ComplaintController.managerApproval);

router.post('/ceo-approval/:complaintId', ComplaintController.ceoApproval);

// Step 8: Mark items as available (by JALEEL_KA or MAINTENANCE_HEAD)
router.post('/items-available/:complaintId', ComplaintController.markItemsAvailable);

// Step 9: Mechanic completes work (updated)
router.post('/rectified/:complaintId', ComplaintController.addSolution);

// Existing routes (unchanged)
router.get('/user/:uniqueCode', ComplaintController.getUserComplaints);
router.get('/get-complaints/:id', ComplaintController.getComplaintDetails);
router.get('/get-all-complaints', ComplaintController.getAllComplaints);

// New workflow management routes
router.get('/status/:status', ComplaintController.getComplaintsByStatus);
router.post('/mechanic-jobs', ComplaintController.getMechanicComplaints);

module.exports = router;