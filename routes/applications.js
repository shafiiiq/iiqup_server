const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');

// POST - Create new application
router.post('/request-service', applicationController.createApplication);

// GET - Get applications by user ID
router.get('/applications/:userId', applicationController.getApplications);

// GET - Get all requests (for admin/HR dashboard)
router.get('/get-all-requests', applicationController.getAllRequests);

// PUT - Change application status (approve/reject)
router.put('/change-status/:id', applicationController.changeStatus);

// POST - Check leave availability
router.post('/check-leave-availability', applicationController.checkLeaveAvailability);

// GET - Get leave balance for user
router.get('/leave-balance/:userId', applicationController.getLeaveBalance);

module.exports = router;