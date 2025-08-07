const Notification = require('../models/notification-model'); // Adjust path as needed

/**
 * Create and store a new notification
 * @param {Object} notificationData - The notification data
 * @param {string} notificationData.title - Notification title
 * @param {Object} notificationData.description - Notification description object
 * @param {Date} [notificationData.time] - Notification time (defaults to current time)
 * @param {string} notificationData.priority - Notification priority (e.g., 'high', 'medium', 'low')
 * @param {string} notificationData.sourceId - Source ID (required)
 * @returns {Promise<Object>} - Created notification object
 */
const createNotification = async (notificationData) => {
  try {
    const {
      title,
      description,
      time = new Date(),
      priority,
    } = notificationData;

    // Create new notification
    const notification = new Notification({
      title,
      description,
      time,
      priority,
      updatedAt: new Date()
    });

    // Save to database
    const savedNotification = await notification.save();
    
    return {
      success: true,
      data: savedNotification,
      message: 'Notification created successfully'
    };

  } catch (error) {
    console.error('Error creating notification:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to create notification'
    };
  }
};

/**
 * Create multiple notifications at once
 * @param {Array<Object>} notificationsArray - Array of notification data objects
 * @returns {Promise<Object>} - Result with created notifications
 */
const createBulkNotifications = async (notificationsArray) => {
  try {
    const notifications = notificationsArray.map(data => ({
      title: data.title,
      description: data.description,
      time: data.time || new Date(),
      priority: data.priority,
      sourceId: data.sourceId,
      updatedAt: new Date()
    }));

    const savedNotifications = await Notification.insertMany(notifications);
    
    return {
      success: true,
      data: savedNotifications,
      count: savedNotifications.length,
      message: 'Bulk notifications created successfully'
    };

  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to create bulk notifications'
    };
  }
};

/**
 * Quick notification creator with minimal required data
 * @param {string} title - Notification title
 * @param {string} sourceId - Source ID
 * @param {Object} [options] - Optional parameters
 * @returns {Promise<Object>} - Created notification
 */
const quickNotification = async (title, sourceId, options = {}) => {
  const notificationData = {
    title,
    sourceId,
    description: options.description || { message: title },
    priority: options.priority || 'medium',
    time: options.time || new Date()
  };

  return await createNotification(notificationData);
};

module.exports = {
  createNotification,
  createBulkNotifications,
  quickNotification
};