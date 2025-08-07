const LocationTrackingService = require('../services/team-traking-services');

class LocationTrackingController {
  
  // POST /team-tracking/location - Save location data
  static async saveLocation(req, res) {
    try {
      const { uniqueCode, latitude, longitude, accuracy, speed, heading } = req.body;
      
      // Validation
      if (!uniqueCode || !latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: uniqueCode, latitude, longitude'
        });
      }

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be numbers'
        });
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude or longitude values'
        });
      }

      const result = await LocationTrackingService.saveLocation({
        uniqueCode,
        latitude,
        longitude,
        accuracy: accuracy || 0,
        speed: speed || 0,
        heading: heading || 0
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Error in saveLocation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /team-tracking/current - Get current locations of all users
  static async getCurrentLocations(req, res) {
    try {
      const locations = await LocationTrackingService.getCurrentLocations();
      
      res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
      });
    } catch (error) {
      console.error('Error in getCurrentLocations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /team-tracking/history/:uniqueCode - Get location history for a specific user
  static async getUserLocationHistory(req, res) {
    try {
      const { uniqueCode } = req.params;
      const { date } = req.query; // Optional date parameter (YYYY-MM-DD)
      
      if (!uniqueCode) {
        return res.status(400).json({
          success: false,
          message: 'UniqueCode is required'
        });
      }

      const locations = await LocationTrackingService.getUserLocationHistory(uniqueCode, date);
      
      res.status(200).json({
        success: true,
        uniqueCode,
        date: date || new Date().toISOString().split('T')[0],
        count: locations.length,
        data: locations
      });
    } catch (error) {
      console.error('Error in getUserLocationHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /team-tracking/history - Get location history for all users
  static async getAllUsersLocationHistory(req, res) {
    try {
      const { date } = req.query; // Optional date parameter (YYYY-MM-DD)
      
      const result = await LocationTrackingService.getAllUsersLocationHistory(date);
      
      res.status(200).json({
        success: true,
        date: date || new Date().toISOString().split('T')[0],
        data: result
      });
    } catch (error) {
      console.error('Error in getAllUsersLocationHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /team-tracking/stats/:uniqueCode - Get user statistics
  static async getUserStats(req, res) {
    try {
      const { uniqueCode } = req.params;
      const { date } = req.query;
      
      if (!uniqueCode) {
        return res.status(400).json({
          success: false,
          message: 'UniqueCode is required'
        });
      }

      const stats = await LocationTrackingService.getUserStats(uniqueCode, date);
      
      if (!stats) {
        return res.status(404).json({
          success: false,
          message: 'No location data found for this user and date'
        });
      }

      res.status(200).json({
        success: true,
        uniqueCode,
        date: date || new Date().toISOString().split('T')[0],
        data: stats
      });
    } catch (error) {
      console.error('Error in getUserStats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /team-tracking/working-hours - Check if currently in working hours
  static async checkWorkingHours(req, res) {
    try {
      const isWorkingHours = LocationTrackingService.isWorkingHours();
      const now = new Date();
      
      res.status(200).json({
        success: true,
        isWorkingHours,
        currentTime: now.toISOString(),
        workingHours: '8:00 AM - 5:00 PM'
      });
    } catch (error) {
      console.error('Error in checkWorkingHours:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // DELETE /team-tracking/cleanup - Cleanup old location data
  static async cleanupOldLocations(req, res) {
    try {
      const { days } = req.query; // Optional days parameter, default 30
      const daysOld = parseInt(days) || 30;
      
      const result = await LocationTrackingService.cleanupOldLocations(daysOld);
      
      res.status(200).json({
        success: true,
        message: `Cleaned up location data older than ${daysOld} days`,
        deletedCount: result.deletedCount
      });
    } catch (error) {
      console.error('Error in cleanupOldLocations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = LocationTrackingController;