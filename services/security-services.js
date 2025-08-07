const mongoose = require('mongoose');
const axios = require('axios');
const geoip = require('geoip-lite');
const useragent = require('useragent');

// Import models (you'll need to create these schemas)

const User = require('../models/user.model'); // Assuming you have a User model
const { UserSession, LoginAttempt, BlockedIP, SecurityAlert, AccessLog } = require('../models/security.model');

class SecurityService {
  constructor() {
    this.suspiciousActivityThreshold = 10; // Number of requests per minute
    this.maxLoginAttempts = 5;
    this.ipLookupCache = new Map();
  }

  // Log access attempt with comprehensive details
  async logAccess(req, userId = null, routeAccessed = null, status = 'success') {
    try {
      const clientIP = this.getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const deviceInfo = this.parseUserAgent(userAgent);
      const geoLocation = await this.getGeoLocation(clientIP);
      
      const accessLog = new AccessLog({
        userId,
        ipAddress: clientIP,
        userAgent,
        deviceInfo,
        geoLocation,
        routeAccessed: routeAccessed || req.originalUrl,
        method: req.method,
        timestamp: new Date(),
        status,
        requestHeaders: this.sanitizeHeaders(req.headers),
        sessionId: req.sessionID || null,
        referrer: req.headers.referer || null,
        responseTime: req.responseTime || null
      });

      await accessLog.save();

      // Check for suspicious activity
      await this.checkSuspiciousActivity(clientIP, userId);

      return accessLog;
    } catch (error) {
      console.error('Error logging access:', error);
      throw error;
    }
  }

  // Get access logs with filters
  async getAccessLogs(page = 1, limit = 50, filters = {}) {
    try {
      const query = {};
      
      if (filters.userId) query.userId = filters.userId;
      if (filters.ipAddress) query.ipAddress = { $regex: filters.ipAddress, $options: 'i' };
      if (filters.route) query.routeAccessed = { $regex: filters.route, $options: 'i' };
      if (filters.filterBy && filters.filterBy !== 'all') {
        query.status = filters.filterBy;
      }
      
      if (filters.dateFrom || filters.dateTo) {
        query.timestamp = {};
        if (filters.dateFrom) query.timestamp.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.timestamp.$lte = new Date(filters.dateTo);
      }

      const totalLogs = await AccessLog.countDocuments(query);
      const logs = await AccessLog.find(query)
        .populate('userId', 'name email role phone')
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Enhance logs with additional security insights
      const enhancedLogs = await Promise.all(logs.map(async (log) => {
        const riskScore = await this.calculateRiskScore(log);
        return {
          ...log,
          riskScore,
          isNewLocation: await this.isNewLocation(log.userId, log.geoLocation),
          isNewDevice: await this.isNewDevice(log.userId, log.deviceInfo)
        };
      }));

      return {
        logs: enhancedLogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalLogs / limit),
          totalLogs,
          hasNext: page < Math.ceil(totalLogs / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching access logs:', error);
      throw error;
    }
  }

  // Log login attempt
  async logLoginAttempt(req, userId = null, status = 'failed', reason = null) {
    try {
      const clientIP = this.getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const deviceInfo = this.parseUserAgent(userAgent);
      const geoLocation = await this.getGeoLocation(clientIP);

      const loginAttempt = new LoginAttempt({
        userId,
        ipAddress: clientIP,
        userAgent,
        deviceInfo,
        geoLocation,
        timestamp: new Date(),
        status,
        failureReason: reason,
        sessionId: req.sessionID || null
      });

      await loginAttempt.save();

      // Check for brute force attempts
      if (status === 'failed') {
        await this.checkBruteForceAttempts(clientIP, userId);
      }

      return loginAttempt;
    } catch (error) {
      console.error('Error logging login attempt:', error);
      throw error;
    }
  }

  // Get active sessions
  async getActiveSessions() {
    try {
      const activeSessions = await UserSession.find({
        isActive: true,
        expiresAt: { $gt: new Date() }
      })
      .populate('userId', 'name email role phone')
      .sort({ lastActivity: -1 })
      .lean();

      // Enhance with location and device info
      const enhancedSessions = await Promise.all(activeSessions.map(async (session) => {
        const geoLocation = await this.getGeoLocation(session.ipAddress);
        const deviceInfo = this.parseUserAgent(session.userAgent);
        
        return {
          ...session,
          geoLocation,
          deviceInfo,
          duration: Date.now() - session.loginTime,
          isCurrentSession: session.sessionId === req?.sessionID
        };
      }));

      return enhancedSessions;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      throw error;
    }
  }

  // Create security alert
  async createSecurityAlert(type, severity, message, metadata = {}) {
    try {
      const alert = new SecurityAlert({
        type,
        severity,
        message,
        metadata,
        timestamp: new Date(),
        isResolved: false
      });

      await alert.save();

      // Send real-time notification to admins
      if (global.io) {
        global.io.to('super-admin').emit('security-alert', {
          alert,
          timestamp: new Date()
        });
      }

      return alert;
    } catch (error) {
      console.error('Error creating security alert:', error);
      throw error;
    }
  }

  // Get security alerts
  async getSecurityAlerts(page = 1, limit = 20, severity = null) {
    try {
      const query = {};
      if (severity) query.severity = severity;

      const totalAlerts = await SecurityAlert.countDocuments(query);
      const alerts = await SecurityAlert.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      return {
        alerts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalAlerts / limit),
          totalAlerts,
          hasNext: page < Math.ceil(totalAlerts / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      throw error;
    }
  }

  // Get user activity timeline
  async getUserActivity(userId, page = 1, limit = 30) {
    try {
      const totalActivities = await AccessLog.countDocuments({ userId });
      const activities = await AccessLog.find({ userId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Get login attempts for this user
      const loginAttempts = await LoginAttempt.find({ userId })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean();

      return {
        activities,
        loginAttempts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalActivities / limit),
          totalActivities,
          hasNext: page < Math.ceil(totalActivities / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }
  }

  // Block IP address
  async blockIPAddress(ipAddress, reason, adminId) {
    try {
      const existingBlock = await BlockedIP.findOne({ ipAddress, isActive: true });
      if (existingBlock) {
        throw new Error('IP address is already blocked');
      }

      const blockedIP = new BlockedIP({
        ipAddress,
        reason,
        blockedBy: adminId,
        blockedAt: new Date(),
        isActive: true
      });

      await blockedIP.save();

      // Create security alert
      await this.createSecurityAlert(
        'IP_BLOCKED',
        'medium',
        `IP address ${ipAddress} has been blocked`,
        { ipAddress, reason, adminId }
      );

      return blockedIP;
    } catch (error) {
      console.error('Error blocking IP address:', error);
      throw error;
    }
  }

  // Check if IP is blocked
  async isIPBlocked(ipAddress) {
    try {
      const blockedIP = await BlockedIP.findOne({ 
        ipAddress, 
        isActive: true 
      });
      return !!blockedIP;
    } catch (error) {
      console.error('Error checking IP block status:', error);
      return false;
    }
  }

  // Get device information
  async getDeviceInformation(page = 1, limit = 30) {
    try {
      const deviceAggregation = await AccessLog.aggregate([
        {
          $group: {
            _id: {
              deviceType: '$deviceInfo.deviceType',
              browser: '$deviceInfo.browser',
              os: '$deviceInfo.os'
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            lastSeen: { $max: '$timestamp' },
            firstSeen: { $min: '$timestamp' }
          }
        },
        {
          $project: {
            deviceType: '$_id.deviceType',
            browser: '$_id.browser',
            os: '$_id.os',
            count: 1,
            uniqueUserCount: { $size: '$uniqueUsers' },
            lastSeen: 1,
            firstSeen: 1
          }
        },
        { $sort: { count: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
      ]);

      const totalDevices = await AccessLog.distinct('deviceInfo.deviceType').length;

      return {
        devices: deviceAggregation,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalDevices / limit),
          totalDevices
        }
      };
    } catch (error) {
      console.error('Error fetching device information:', error);
      throw error;
    }
  }

  // Get geo-location analytics
  async getGeoLocationAnalytics(timeframe = '7d') {
    try {
      const timeframeDate = this.getTimeframeDate(timeframe);
      
      const geoAnalytics = await AccessLog.aggregate([
        {
          $match: {
            timestamp: { $gte: timeframeDate }
          }
        },
        {
          $group: {
            _id: {
              country: '$geoLocation.country',
              region: '$geoLocation.region',
              city: '$geoLocation.city'
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueIPs: { $addToSet: '$ipAddress' }
          }
        },
        {
          $project: {
            location: {
              country: '$_id.country',
              region: '$_id.region',
              city: '$_id.city'
            },
            accessCount: '$count',
            uniqueUserCount: { $size: '$uniqueUsers' },
            uniqueIPCount: { $size: '$uniqueIPs' }
          }
        },
        { $sort: { accessCount: -1 } },
        { $limit: 50 }
      ]);

      return geoAnalytics;
    } catch (error) {
      console.error('Error fetching geo-location analytics:', error);
      throw error;
    }
  }

  // Get security dashboard stats
  async getSecurityDashboardStats(timeframe = '24h') {
    try {
      const timeframeDate = this.getTimeframeDate(timeframe);
      
      const [
        totalAccess,
        failedLogins,
        activeUsers,
        blockedIPs,
        securityAlerts,
        topCountries,
        topDevices
      ] = await Promise.all([
        AccessLog.countDocuments({ timestamp: { $gte: timeframeDate } }),
        LoginAttempt.countDocuments({ 
          timestamp: { $gte: timeframeDate }, 
          status: 'failed' 
        }),
        AccessLog.distinct('userId', { timestamp: { $gte: timeframeDate } }).length,
        BlockedIP.countDocuments({ isActive: true }),
        SecurityAlert.countDocuments({ 
          timestamp: { $gte: timeframeDate },
          isResolved: false 
        }),
        this.getTopCountries(timeframeDate),
        this.getTopDevices(timeframeDate)
      ]);

      return {
        overview: {
          totalAccess,
          failedLogins,
          activeUsers,
          blockedIPs,
          securityAlerts
        },
        analytics: {
          topCountries,
          topDevices
        },
        timeframe
      };
    } catch (error) {
      console.error('Error fetching security dashboard stats:', error);
      throw error;
    }
  }

  // Helper Methods

  // Get client IP address
  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip ||
           '127.0.0.1';
  }

  // Parse user agent for device information
  parseUserAgent(userAgentString) {
    const agent = useragent.parse(userAgentString);
    return {
      browser: `${agent.family} ${agent.major}`,
      os: `${agent.os.family} ${agent.os.major}`,
      device: agent.device.family,
      deviceType: this.getDeviceType(userAgentString),
      raw: userAgentString
    };
  }

  // Determine device type
  getDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // Get geo-location from IP
  async getGeoLocation(ipAddress) {
    try {
      // Skip localhost/private IPs
      if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
        return {
          country: 'Local',
          region: 'Local',
          city: 'Local',
          timezone: 'Local',
          latitude: null,
          longitude: null
        };
      }

      // Check cache first
      if (this.ipLookupCache.has(ipAddress)) {
        return this.ipLookupCache.get(ipAddress);
      }

      // Try geoip-lite first (local database)
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        const location = {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          timezone: geo.timezone,
          latitude: geo.ll ? geo.ll[0] : null,
          longitude: geo.ll ? geo.ll[1] : null
        };
        
        // Cache the result
        this.ipLookupCache.set(ipAddress, location);
        return location;
      }

      // Fallback to external API (optional)
      try {
        const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
          timeout: 5000
        });
        
        if (response.data.status === 'success') {
          const location = {
            country: response.data.country,
            region: response.data.regionName,
            city: response.data.city,
            timezone: response.data.timezone,
            latitude: response.data.lat,
            longitude: response.data.lon
          };
          
          this.ipLookupCache.set(ipAddress, location);
          return location;
        }
      } catch (apiError) {
        console.warn('External IP lookup failed:', apiError.message);
      }

      // Default fallback
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown',
        latitude: null,
        longitude: null
      };
    } catch (error) {
      console.error('Error getting geo-location:', error);
      return {
        country: 'Error',
        region: 'Error',
        city: 'Error',
        timezone: 'Error',
        latitude: null,
        longitude: null
      };
    }
  }

  // Sanitize request headers for logging
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    delete sanitized['x-auth-token'];
    
    return sanitized;
  }

  // Check for suspicious activity
  async checkSuspiciousActivity(ipAddress, userId) {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      
      // Count requests from this IP in the last minute
      const recentRequests = await AccessLog.countDocuments({
        ipAddress,
        timestamp: { $gte: oneMinuteAgo }
      });

      if (recentRequests > this.suspiciousActivityThreshold) {
        await this.createSecurityAlert(
          'SUSPICIOUS_ACTIVITY',
          'high',
          `Suspicious activity detected from IP ${ipAddress}: ${recentRequests} requests in 1 minute`,
          { ipAddress, userId, requestCount: recentRequests }
        );
      }

      // Check for unusual location access
      if (userId) {
        const geoLocation = await this.getGeoLocation(ipAddress);
        const isNewLocation = await this.isNewLocation(userId, geoLocation);
        
        if (isNewLocation && geoLocation.country !== 'Local') {
          await this.createSecurityAlert(
            'NEW_LOCATION_ACCESS',
            'medium',
            `User accessed from new location: ${geoLocation.city}, ${geoLocation.country}`,
            { userId, ipAddress, geoLocation }
          );
        }
      }
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
    }
  }

  // Check for brute force login attempts
  async checkBruteForceAttempts(ipAddress, userId) {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000);
      
      // Count failed login attempts from this IP
      const failedAttempts = await LoginAttempt.countDocuments({
        ipAddress,
        status: 'failed',
        timestamp: { $gte: fifteenMinutesAgo }
      });

      if (failedAttempts >= this.maxLoginAttempts) {
        // Auto-block IP for brute force attempts
        await this.blockIPAddress(
          ipAddress, 
          `Brute force attack detected: ${failedAttempts} failed login attempts`,
          'system'
        );

        await this.createSecurityAlert(
          'BRUTE_FORCE_ATTACK',
          'critical',
          `Brute force attack detected from IP ${ipAddress}. IP has been automatically blocked.`,
          { ipAddress, userId, failedAttempts }
        );
      }
    } catch (error) {
      console.error('Error checking brute force attempts:', error);
    }
  }

  // Calculate risk score for access log
  async calculateRiskScore(log) {
    let riskScore = 0;
    
    // Base score
    riskScore += 10;
    
    // Failed access
    if (log.status === 'failed') riskScore += 30;
    
    // New location
    if (await this.isNewLocation(log.userId, log.geoLocation)) riskScore += 20;
    
    // New device
    if (await this.isNewDevice(log.userId, log.deviceInfo)) riskScore += 15;
    
    // Unusual time (outside business hours)
    const hour = new Date(log.timestamp).getHours();
    if (hour < 6 || hour > 22) riskScore += 10;
    
    // Suspicious countries (you can customize this list)
    const suspiciousCountries = ['CN', 'RU', 'KP', 'IR'];
    if (suspiciousCountries.includes(log.geoLocation?.country)) riskScore += 25;
    
    return Math.min(riskScore, 100); // Cap at 100
  }

  // Check if location is new for user
  async isNewLocation(userId, geoLocation) {
    if (!userId || !geoLocation) return false;
    
    try {
      const existingLocation = await AccessLog.findOne({
        userId,
        'geoLocation.country': geoLocation.country,
        'geoLocation.city': geoLocation.city
      });
      
      return !existingLocation;
    } catch (error) {
      console.error('Error checking new location:', error);
      return false;
    }
  }

  // Check if device is new for user
  async isNewDevice(userId, deviceInfo) {
    if (!userId || !deviceInfo) return false;
    
    try {
      const existingDevice = await AccessLog.findOne({
        userId,
        'deviceInfo.browser': deviceInfo.browser,
        'deviceInfo.os': deviceInfo.os
      });
      
      return !existingDevice;
    } catch (error) {
      console.error('Error checking new device:', error);
      return false;
    }
  }

  // Get IP location details
  async getIPLocationDetails(ipAddress) {
    try {
      const geoLocation = await this.getGeoLocation(ipAddress);
      
      // Get additional stats for this IP
      const [accessCount, uniqueUsers, lastAccess, firstAccess] = await Promise.all([
        AccessLog.countDocuments({ ipAddress }),
        AccessLog.distinct('userId', { ipAddress }),
        AccessLog.findOne({ ipAddress }).sort({ timestamp: -1 }),
        AccessLog.findOne({ ipAddress }).sort({ timestamp: 1 })
      ]);

      const isBlocked = await this.isIPBlocked(ipAddress);

      return {
        ipAddress,
        geoLocation,
        statistics: {
          totalAccess: accessCount,
          uniqueUsers: uniqueUsers.length,
          lastAccess: lastAccess?.timestamp,
          firstAccess: firstAccess?.timestamp
        },
        security: {
          isBlocked,
          riskLevel: this.calculateIPRiskLevel(accessCount, uniqueUsers.length)
        }
      };
    } catch (error) {
      console.error('Error getting IP details:', error);
      throw error;
    }
  }

  // Calculate IP risk level
  calculateIPRiskLevel(accessCount, uniqueUsers) {
    if (accessCount > 1000 && uniqueUsers === 1) return 'high';
    if (accessCount > 500) return 'medium';
    if (uniqueUsers > 10) return 'medium';
    return 'low';
  }

  // Unblock IP address
  async unblockIPAddress(ipAddress, adminId) {
    try {
      const blockedIP = await BlockedIP.findOneAndUpdate(
        { ipAddress, isActive: true },
        { 
          isActive: false, 
          unblockedBy: adminId, 
          unblockedAt: new Date() 
        },
        { new: true }
      );

      if (!blockedIP) {
        throw new Error('IP address is not currently blocked');
      }

      await this.createSecurityAlert(
        'IP_UNBLOCKED',
        'low',
        `IP address ${ipAddress} has been unblocked`,
        { ipAddress, adminId }
      );

      return blockedIP;
    } catch (error) {
      console.error('Error unblocking IP address:', error);
      throw error;
    }
  }

  // Get blocked IPs
  async getBlockedIPs(page = 1, limit = 20) {
    try {
      const totalBlocked = await BlockedIP.countDocuments({ isActive: true });
      const blockedIPs = await BlockedIP.find({ isActive: true })
        .populate('blockedBy', 'name email')
        .populate('unblockedBy', 'name email')
        .sort({ blockedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Enhance with geo-location
      const enhancedIPs = await Promise.all(blockedIPs.map(async (ip) => {
        const geoLocation = await this.getGeoLocation(ip.ipAddress);
        return { ...ip, geoLocation };
      }));

      return {
        blockedIPs: enhancedIPs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalBlocked / limit),
          totalBlocked,
          hasNext: page < Math.ceil(totalBlocked / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
      throw error;
    }
  }

  // Force logout user
  async forceLogoutUser(userId, sessionId, adminId) {
    try {
      let query = {};
      
      if (sessionId) {
        query.sessionId = sessionId;
      } else if (userId) {
        query.userId = userId;
      } else {
        throw new Error('Either userId or sessionId is required');
      }

      const sessions = await UserSession.updateMany(
        { ...query, isActive: true },
        { 
          isActive: false, 
          logoutTime: new Date(),
          logoutReason: 'force_logout',
          logoutBy: adminId
        }
      );

      // Send real-time logout signal
      if (global.io && sessionId) {
        global.io.to(sessionId).emit('force-logout', {
          message: 'Your session has been terminated by an administrator',
          timestamp: new Date()
        });
      }

      await this.createSecurityAlert(
        'FORCE_LOGOUT',
        'medium',
        `User session(s) forcefully terminated by admin`,
        { userId, sessionId, adminId, sessionsTerminated: sessions.modifiedCount }
      );

      return { sessionsTerminated: sessions.modifiedCount };
    } catch (error) {
      console.error('Error forcing logout:', error);
      throw error;
    }
  }

  // Get login attempts
  async getLoginAttempts(page = 1, limit = 30, filters = {}) {
    try {
      const query = {};
      
      if (filters.status) query.status = filters.status;
      if (filters.ipAddress) query.ipAddress = { $regex: filters.ipAddress, $options: 'i' };
      
      if (filters.dateFrom || filters.dateTo) {
        query.timestamp = {};
        if (filters.dateFrom) query.timestamp.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.timestamp.$lte = new Date(filters.dateTo);
      }

      const totalAttempts = await LoginAttempt.countDocuments(query);
      const attempts = await LoginAttempt.find(query)
        .populate('userId', 'name email role')
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      return {
        attempts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalAttempts / limit),
          totalAttempts,
          hasNext: page < Math.ceil(totalAttempts / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching login attempts:', error);
      throw error;
    }
  }

  // Get top countries
  async getTopCountries(timeframeDate) {
    try {
      return await AccessLog.aggregate([
        { $match: { timestamp: { $gte: timeframeDate } } },
        {
          $group: {
            _id: '$geoLocation.country',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
    } catch (error) {
      console.error('Error fetching top countries:', error);
      return [];
    }
  }

  // Get top devices
  async getTopDevices(timeframeDate) {
    try {
      return await AccessLog.aggregate([
        { $match: { timestamp: { $gte: timeframeDate } } },
        {
          $group: {
            _id: '$deviceInfo.deviceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
    } catch (error) {
      console.error('Error fetching top devices:', error);
      return [];
    }
  }

  // Get timeframe date
  getTimeframeDate(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  // Export security logs
  async exportSecurityLogs(format, dateFrom, dateTo, logType) {
    try {
      const query = {};
      
      if (dateFrom || dateTo) {
        query.timestamp = {};
        if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
        if (dateTo) query.timestamp.$lte = new Date(dateTo);
      }

      let data = [];
      
      switch (logType) {
        case 'access':
          data = await AccessLog.find(query).populate('userId', 'name email').lean();
          break;
        case 'login':
          data = await LoginAttempt.find(query).populate('userId', 'name email').lean();
          break;
        case 'alerts':
          data = await SecurityAlert.find(query).lean();
          break;
        default:
          // Get all types
          const [accessLogs, loginAttempts, alerts] = await Promise.all([
            AccessLog.find(query).populate('userId', 'name email').lean(),
            LoginAttempt.find(query).populate('userId', 'name email').lean(),
            SecurityAlert.find(query).lean()
          ]);
          data = { accessLogs, loginAttempts, alerts };
      }

      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);
        case 'csv':
          return this.convertToCSV(data);
        default:
          return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      console.error('Error exporting security logs:', error);
      throw error;
    }
  }

  // Convert data to CSV format
  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data available';
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => {
      return Object.values(row).map(value => {
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value).replace(/"/g, '""');
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  // Get real-time monitoring data
  async getRealtimeMonitoringData() {
    try {
      const now = new Date();
      const lastMinute = new Date(now.getTime() - 60000);
      const lastHour = new Date(now.getTime() - 3600000);

      const [
        activeRequests,
        recentFailedLogins,
        recentAlerts,
        currentSessions
      ] = await Promise.all([
        AccessLog.countDocuments({ timestamp: { $gte: lastMinute } }),
        LoginAttempt.countDocuments({ 
          timestamp: { $gte: lastHour }, 
          status: 'failed' 
        }),
        SecurityAlert.countDocuments({ 
          timestamp: { $gte: lastHour },
          isResolved: false 
        }),
        UserSession.countDocuments({ isActive: true })
      ]);

      return {
        activeRequests,
        recentFailedLogins,
        recentAlerts,
        currentSessions,
        timestamp: now
      };
    } catch (error) {
      console.error('Error fetching real-time monitoring data:', error);
      throw error;
    }
  }
}

module.exports = SecurityService;