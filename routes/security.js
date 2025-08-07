const express = require('express');
const router = express.Router();
const SecurityController = require('../controllers/security.controller');

// Initialize security controller
const securityController = new SecurityController();

// Get all access logs (Super Admin only)
router.get('/access-logs', securityController.getAccessLogs);

// Get active sessions
router.get('/active-sessions', securityController.getActiveSessions);

// Get security alerts
router.get('/security-alerts', securityController.getSecurityAlerts);

// Get user activity timeline
router.get('/user-activity/:userId', securityController.getUserActivity);

// Get IP location details
router.get('/ip-details/:ipAddress', securityController.getIPDetails);

// Get device information
router.get('/device-info', securityController.getDeviceInfo);

// Block/Unblock IP address
router.post('/block-ip', securityController.blockIP);
router.post('/unblock-ip', securityController.unblockIP);

// Get blocked IPs
router.get('/blocked-ips', securityController.getBlockedIPs);

// Force logout user session
router.post('/force-logout', securityController.forceLogout);

// Get login attempts
router.get('/login-attempts', securityController.getLoginAttempts);

// Get geo-location analytics
router.get('/geo-analytics', securityController.getGeoAnalytics);

// Get security dashboard stats
router.get('/dashboard-stats', securityController.getDashboardStats);

// Export security data
router.get('/export-logs', securityController.exportSecurityLogs);

// Get real-time monitoring data
router.get('/realtime-monitoring', securityController.getRealtimeMonitoring);

module.exports = router;