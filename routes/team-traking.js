const express = require('express');
const router = express.Router();
const LocationTrackingController = require('../controllers/team-tracking.controller');

// POST /team-tracking/location - Save location data
router.post('/location', LocationTrackingController.saveLocation);

// GET /team-tracking/current - Get current locations of all users
router.get('/current', LocationTrackingController.getCurrentLocations);

// GET /team-tracking/history/:uniqueCode - Get location history for a specific user
router.get('/history/:uniqueCode', LocationTrackingController.getUserLocationHistory);

// GET /team-tracking/history - Get location history for all users
router.get('/history', LocationTrackingController.getAllUsersLocationHistory);

// GET /team-tracking/stats/:uniqueCode - Get user statistics
router.get('/stats/:uniqueCode', LocationTrackingController.getUserStats);

// GET /team-tracking/working-hours - Check if currently in working hours
router.get('/working-hours', LocationTrackingController.checkWorkingHours);

// DELETE /team-tracking/cleanup - Cleanup old location data (admin only)
router.delete('/cleanup', LocationTrackingController.cleanupOldLocations);

module.exports = router;