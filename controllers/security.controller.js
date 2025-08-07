const SecurityService = require('../services/security-services');

class SecurityController {
  constructor() {
    this.securityService = new SecurityService();
  }

  // Get all access logs
  getAccessLogs = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const filterBy = req.query.filterBy || 'all';
      const userId = req.query.userId;
      const ipAddress = req.query.ip;
      const dateFrom = req.query.dateFrom;
      const dateTo = req.query.dateTo;
      const route = req.query.route;

      const filters = {
        userId,
        ipAddress,
        dateFrom,
        dateTo,
        filterBy,
        route
      };

      const logs = await this.securityService.getAccessLogs(page, limit, filters);
      
      res.status(200).json({
        success: true,
        data: logs,
        message: 'Access logs retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching access logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch access logs',
        error: error.message
      });
    }
  };

  // Get active sessions
  getActiveSessions = async (req, res) => {
    try {
      const sessions = await this.securityService.getActiveSessions();
      
      res.status(200).json({
        success: true,
        data: sessions,
        message: 'Active sessions retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active sessions',
        error: error.message
      });
    }
  };

  // Get security alerts
  getSecurityAlerts = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const severity = req.query.severity;
      
      const alerts = await this.securityService.getSecurityAlerts(page, limit, severity);
      
      res.status(200).json({
        success: true,
        data: alerts,
        message: 'Security alerts retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security alerts',
        error: error.message
      });
    }
  };

  // Get user activity timeline
  getUserActivity = async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      
      const activity = await this.securityService.getUserActivity(userId, page, limit);
      
      res.status(200).json({
        success: true,
        data: activity,
        message: 'User activity retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user activity',
        error: error.message
      });
    }
  };

  // Get IP location details
  getIPDetails = async (req, res) => {
    try {
      const { ipAddress } = req.params;
      
      const ipDetails = await this.securityService.getIPLocationDetails(ipAddress);
      
      res.status(200).json({
        success: true,
        data: ipDetails,
        message: 'IP details retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching IP details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch IP details',
        error: error.message
      });
    }
  };

  // Get device information
  getDeviceInfo = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      
      const deviceInfo = await this.securityService.getDeviceInformation(page, limit);
      
      res.status(200).json({
        success: true,
        data: deviceInfo,
        message: 'Device information retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching device info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch device information',
        error: error.message
      });
    }
  };

  // Block IP address
  blockIP = async (req, res) => {
    try {
      const { ipAddress, reason, adminId } = req.body;
      
      if (!ipAddress || !reason || !adminId) {
        return res.status(400).json({
          success: false,
          message: 'IP address, reason, and admin ID are required'
        });
      }
      
      const result = await this.securityService.blockIPAddress(ipAddress, reason, adminId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'IP address blocked successfully'
      });
    } catch (error) {
      console.error('Error blocking IP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block IP address',
        error: error.message
      });
    }
  };

  // Unblock IP address
  unblockIP = async (req, res) => {
    try {
      const { ipAddress, adminId } = req.body;
      
      if (!ipAddress || !adminId) {
        return res.status(400).json({
          success: false,
          message: 'IP address and admin ID are required'
        });
      }
      
      const result = await this.securityService.unblockIPAddress(ipAddress, adminId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'IP address unblocked successfully'
      });
    } catch (error) {
      console.error('Error unblocking IP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unblock IP address',
        error: error.message
      });
    }
  };

  // Get blocked IPs
  getBlockedIPs = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const blockedIPs = await this.securityService.getBlockedIPs(page, limit);
      
      res.status(200).json({
        success: true,
        data: blockedIPs,
        message: 'Blocked IPs retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch blocked IPs',
        error: error.message
      });
    }
  };

  // Force logout user session
  forceLogout = async (req, res) => {
    try {
      const { userId, sessionId, adminId } = req.body;
      
      if (!adminId) {
        return res.status(400).json({
          success: false,
          message: 'Admin ID is required'
        });
      }
      
      const result = await this.securityService.forceLogoutUser(userId, sessionId, adminId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'User session terminated successfully'
      });
    } catch (error) {
      console.error('Error forcing logout:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to terminate user session',
        error: error.message
      });
    }
  };

  // Get login attempts
  getLoginAttempts = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const status = req.query.status; // success, failed, blocked
      const ipAddress = req.query.ip;
      const dateFrom = req.query.dateFrom;
      const dateTo = req.query.dateTo;

      const filters = {
        status,
        ipAddress,
        dateFrom,
        dateTo
      };
      
      const loginAttempts = await this.securityService.getLoginAttempts(page, limit, filters);
      
      res.status(200).json({
        success: true,
        data: loginAttempts,
        message: 'Login attempts retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching login attempts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch login attempts',
        error: error.message
      });
    }
  };

  // Get geo-location analytics
  getGeoAnalytics = async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '7d'; // 1d, 7d, 30d, 90d
      
      const geoAnalytics = await this.securityService.getGeoLocationAnalytics(timeframe);
      
      res.status(200).json({
        success: true,
        data: geoAnalytics,
        message: 'Geo-location analytics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching geo analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch geo-location analytics',
        error: error.message
      });
    }
  };

  // Get security dashboard stats
  getDashboardStats = async (req, res) => {
    try {
      const timeframe = req.query.timeframe || '24h'; // 1h, 24h, 7d, 30d
      
      const stats = await this.securityService.getSecurityDashboardStats(timeframe);
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Security dashboard stats retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security dashboard stats',
        error: error.message
      });
    }
  };

  // Export security logs
  exportSecurityLogs = async (req, res) => {
    try {
      const format = req.query.format || 'csv'; // csv, json, xlsx
      const dateFrom = req.query.dateFrom;
      const dateTo = req.query.dateTo;
      const logType = req.query.logType || 'all'; // access, login, alerts, all
      
      const exportData = await this.securityService.exportSecurityLogs(format, dateFrom, dateTo, logType);
      
      // Set appropriate headers for file download
      const filename = `security_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', this.getContentType(format));
      
      res.send(exportData);
    } catch (error) {
      console.error('Error exporting security logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export security logs',
        error: error.message
      });
    }
  };

  // Get real-time monitoring data
  getRealtimeMonitoring = async (req, res) => {
    try {
      const monitoringData = await this.securityService.getRealtimeMonitoringData();
      
      res.status(200).json({
        success: true,
        data: monitoringData,
        message: 'Real-time monitoring data retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching real-time monitoring data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch real-time monitoring data',
        error: error.message
      });
    }
  };

  // Helper method to get content type for file exports
  getContentType = (format) => {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'text/plain';
    }
  };
}

module.exports = SecurityController;