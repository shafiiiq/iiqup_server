const express = require('express');
const router = express.Router();
const ComplaintController = require('../controllers/complaint.controller');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB per file
        files: 10
    }
});

router.post('/register', upload.array('files', 10), ComplaintController.registerComplaint);

// Step 2: MAINTENANCE_HEAD assigns mechanic  
router.post('/assign-mechanic/:complaintId', ComplaintController.assignMechanic);

// Step 3: Mechanic requests items/tools
router.post('/mechanic-request/:complaintId', ComplaintController.mechanicRequestItems);

// Step 4: MAINTENANCE_HEAD forwards to WORKSHOP_MANAGER
router.post('/forward-to-workshop/:complaintId', ComplaintController.forwardToWorkshop);

router.post('/forward-to-workshop/without-lpo/:complaintId', ComplaintController.forwardToWorkshopWithoutLPO);

router.post('/approve-item/without-lpo/:complaintId', ComplaintController.approveItemWithoutLPO);

// Step 5: WORKSHOP_MANAGER creates LPO
router.post('/create-lpo/:complaintId', ComplaintController.createLPOForComplaint);

router.post('/upload-lpo/:complaintId', ComplaintController.uploadLPOForComplaint);

router.post('/purchase-approval/:complaintId', ComplaintController.purchaseApproval);

router.post('/manager-approval/:complaintId', ComplaintController.managerApproval);

router.post('/ceo-approval/:complaintId', ComplaintController.ceoApproval);

router.post('/accounts-approval/:complaintId', ComplaintController.accountsApproval);

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

