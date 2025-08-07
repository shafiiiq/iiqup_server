// controllers/notification.controller.js
const notificationsService  = require('../services/notification-services');
const { sendNotificationToUser, broadcastNotification } = require('../utils/websocket');
// Import your notification model here
// const Notification = require('../models/notification.model');

const getAllNotifications = async (req, res) => {
  try {
    // Get all notifications from the service
    const notifications = await notificationsService.getAllNotificationsService();
    
    res.status(200).json({
      status: 200,
      message: 'Notifications retrieved successfully',
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const { title, description, priority, type, targetUser } = req.body;
    
    // Create notification in database
    const newNotification = {
      title,
      description,
      priority: priority || 'medium',
      type: type || 'normal',
      time: new Date().toISOString(),
      _id: new Date().getTime().toString() // Generate temporary ID
    };
    
    // Save to database (implement your database logic here)
    // const savedNotification = await Notification.create(newNotification);
    
    // Send real-time notification
    if (targetUser) {
      // Send to specific user
      sendNotificationToUser(targetUser, newNotification);
    } else {
      // Broadcast to all users
      broadcastNotification(newNotification);
    }
    
    res.status(201).json({
      status: 201,
      message: 'Notification created and sent successfully',
      data: newNotification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    // Implement your stats logic here
    const stats = {
      total: 0,
      normal: 0,
      special: 0,
      highPriority: 0,
      unread: 0
    };
    
    res.status(200).json({
      status: 200,
      message: 'Stats retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update notification as read in database
    // await Notification.findByIdAndUpdate(id, { isRead: true });
    
    res.status(200).json({
      status: 200,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete notification from database
    // await Notification.findByIdAndDelete(id);
    
    res.status(200).json({
      status: 200,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      status: 500,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getPendingNotifications = async (req, res) => {
  try {
    const { uniqueCode, since } = req.body;
    
    if (!uniqueCode) {
      return res.status(400).json({ error: 'uniqueCode is required' });
    }

    const notifications = await notificationsService.getPendingNotifications(uniqueCode, since);
    res.json({ notifications });
  } catch (error) {
    console.error('Error in getPendingNotifications:', error);
    res.status(500).json({ error: 'Failed to fetch pending notifications' });
  }
};

module.exports = {
  getAllNotifications,
  createNotification,
  getNotificationStats,
  markAsRead,
  deleteNotification,
  getPendingNotifications
};