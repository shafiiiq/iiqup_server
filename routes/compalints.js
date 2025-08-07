const express = require('express');
const router = express.Router();
const ComplaintController = require('../controllers/complaint.controller');

// Register a new complaint with media files
router.post('/register', ComplaintController.registerComplaint);

// Get all complaints for a user
router.get('/user/:uniqueCode', ComplaintController.getUserComplaints);

// Get complaint details by ID
router.get('/get-complaints/:id', ComplaintController.getComplaintDetails);

router.post('/rectified/:complaintId', ComplaintController.addSolution);

router.get('/get-all-complaints', ComplaintController.getAllComplaints);

module.exports = router;