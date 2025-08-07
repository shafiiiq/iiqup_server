const LocationTracking = require('../models/team-tracking.model');
const axios = require('axios');

class LocationTrackingService {
  
  // Check if current time is within working hours (8 AM to 5 PM)
  static isWorkingHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 8 && hour < 17; // 8 AM to 5 PM (17:00 in 24-hour format)
  }

  // Get place name from coordinates using reverse geocoding
  static async getPlaceName(latitude, longitude) {
    try {
      // Using OpenStreetMap Nominatim API (free alternative to Google Maps)
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LocationTrackingApp/1.0'
          }
        }
      );
      
      if (response.data && response.data.display_name) {
        return {
          placeName: response.data.name || response.data.display_name.split(',')[0],
          address: response.data.display_name
        };
      }
      
      return { placeName: 'Unknown Location', address: 'Unknown Address' };
    } catch (error) {
      console.error('Error getting place name:', error.message);
      return { placeName: 'Unknown Location', address: 'Unknown Address' };
    }
  }

  // Save location data
  static async saveLocation(locationData) {
    try {
      const { uniqueCode, latitude, longitude, accuracy, speed, heading } = locationData;
      
      // Check if it's working hours
      const isWorkingHours = this.isWorkingHours();
      
      if (!isWorkingHours) {
        return { success: false, message: 'Location tracking is only active during working hours (8 AM - 5 PM)' };
      }

      // Get place name
      const { placeName, address } = await this.getPlaceName(latitude, longitude);
      
      // Create tracking date string
      const trackingDate = new Date().toISOString().split('T')[0];
      
      const location = new LocationTracking({
        uniqueCode,
        latitude,
        longitude,
        placeName,
        address,
        accuracy,
        speed,
        heading,
        isWorkingHours,
        trackingDate
      });

      await location.save();
      
      return { success: true, data: location };
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  }

  // Get current locations of all active users
  static async getCurrentLocations() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get the latest location for each user for today
      const pipeline = [
        {
          $match: {
            trackingDate: today,
            isWorkingHours: true
          }
        },
        {
          $sort: { timestamp: -1 }
        },
        {
          $group: {
            _id: '$uniqueCode',
            latestLocation: { $first: '$$ROOT' }
          }
        },
        {
          $replaceRoot: { newRoot: '$latestLocation' }
        },
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Only locations from last 5 minutes
          }
        }
      ];

      const locations = await LocationTracking.aggregate(pipeline);
      return locations;
    } catch (error) {
      console.error('Error getting current locations:', error);
      throw error;
    }
  }

  // Get location history for a specific user
  static async getUserLocationHistory(uniqueCode, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const locations = await LocationTracking.find({
        uniqueCode,
        trackingDate: targetDate,
        isWorkingHours: true
      }).sort({ timestamp: 1 });

      return locations;
    } catch (error) {
      console.error('Error getting user location history:', error);
      throw error;
    }
  }

  // Get all users location history for a specific date
  static async getAllUsersLocationHistory(date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const pipeline = [
        {
          $match: {
            trackingDate: targetDate,
            isWorkingHours: true
          }
        },
        {
          $group: {
            _id: '$uniqueCode',
            locations: {
              $push: {
                latitude: '$latitude',
                longitude: '$longitude',
                placeName: '$placeName',
                address: '$address',
                timestamp: '$timestamp',
                accuracy: '$accuracy',
                speed: '$speed'
              }
            }
          }
        },
        {
          $project: {
            uniqueCode: '$_id',
            _id: 0,
            locations: {
              $sortArray: {
                input: '$locations',
                sortBy: { timestamp: 1 }
              }
            }
          }
        }
      ];

      const result = await LocationTracking.aggregate(pipeline);
      return result;
    } catch (error) {
      console.error('Error getting all users location history:', error);
      throw error;
    }
  }

  // Delete old location data (cleanup)
  static async cleanupOldLocations(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await LocationTracking.deleteMany({
        createdAt: { $lt: cutoffDate }
      });
      
      return result;
    } catch (error) {
      console.error('Error cleaning up old locations:', error);
      throw error;
    }
  }

  // Get user statistics
  static async getUserStats(uniqueCode, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const stats = await LocationTracking.aggregate([
        {
          $match: {
            uniqueCode,
            trackingDate: targetDate,
            isWorkingHours: true
          }
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: 1 },
            firstLocation: { $min: '$timestamp' },
            lastLocation: { $max: '$timestamp' },
            avgAccuracy: { $avg: '$accuracy' },
            maxSpeed: { $max: '$speed' },
            locations: {
              $push: {
                latitude: '$latitude',
                longitude: '$longitude',
                timestamp: '$timestamp'
              }
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return null;
      }

      // Calculate total distance traveled (approximate)
      const locations = stats[0].locations.sort((a, b) => a.timestamp - b.timestamp);
      let totalDistance = 0;
      
      for (let i = 1; i < locations.length; i++) {
        const distance = this.calculateDistance(
          locations[i-1].latitude,
          locations[i-1].longitude,
          locations[i].latitude,
          locations[i].longitude
        );
        totalDistance += distance;
      }

      return {
        ...stats[0],
        totalDistance: Math.round(totalDistance * 100) / 100 // Round to 2 decimal places
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Calculate distance between two coordinates (Haversine formula)
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in kilometers
    return d;
  }

  static deg2rad(deg) {
    return deg * (Math.PI/180);
  }
}

module.exports = LocationTrackingService;