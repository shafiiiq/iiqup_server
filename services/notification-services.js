// Import your Notification model
const Notification = require('../models/notification-model'); // Adjust path as needed

const getAllNotificationsService = async () => {
  try {
    // Fetch all notifications from the database
    // You can add sorting, filtering, or population as needed
    const notifications = await Notification.find()
    
    return notifications;
  } catch (error) {
    console.error('Error in getAllNotificationsService:', error);
    throw new Error('Failed to retrieve notifications from database');
  }
};

const getPendingNotifications = async (uniqueCode, since) => {
  try {
    
    const query = {
      // 'description.uniqueCode': uniqueCode,
      createdAt: { $gte: new Date(since) }
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .lean();

      console.log(notifications);
      

    return notifications;
  } catch (error) {
    console.error('Error in getPendingNotifications service:', error);
    throw error;
  }
};

module.exports = {
  getAllNotificationsService,
  getPendingNotifications
};