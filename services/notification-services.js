// Import your Notification model
const Notification = require('../models/notification-model'); // Adjust path as needed
const User = require('../models/user.model');

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

const getPendingNotifications = async (uniqueCode, since, limit = 100) => {
  try {
    console.log('📬 Fetching pending notifications...');
    console.log('User:', uniqueCode);
    console.log('Since:', since);

    if (!uniqueCode) {
      throw new Error('uniqueCode is required');
    }

    // Fetch from last 7 days (as fallback)
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const fetchFromDate = sevenDaysAgo;

    console.log(`📅 Fetching notifications from: ${fetchFromDate.toISOString()}`);

    // IMPORTANT: Fetch notifications NOT YET DELIVERED to this user
    const normalNotifications = await Notification.find({
      createdAt: { $gte: fetchFromDate },
      // Only get notifications not delivered to this user
      'deliveredTo.uniqueCode': { $ne: uniqueCode }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    console.log(`📢 Found ${normalNotifications.length} undelivered normal notifications`);

    // Fetch special notifications
    const user = await User.findOne({ uniqueCode }).select('specialNotification');

    let specialNotifications = [];
    if (user && user.specialNotification) {
      specialNotifications = user.specialNotification.filter(notif => {
        const notifDate = new Date(notif.time || notif.createdAt);
        return notifDate >= fetchFromDate;
      });
    }

    console.log(`⭐ Found ${specialNotifications.length} special notifications`);

    // Combine all notifications
    const allNotifications = [
      ...normalNotifications.map(n => ({
        ...n,
        type: 'normal',
        _id: n._id.toString(),
        time: n.createdAt || n.time,
      })),
      ...specialNotifications.map(n => ({
        ...n,
        type: 'special',
        _id: n._id ? n._id.toString() : `special_${Date.now()}_${Math.random()}`,
        time: n.time || n.createdAt,
      }))
    ];

    // Sort by time
    allNotifications.sort((a, b) => {
      const dateA = new Date(a.time || a.createdAt);
      const dateB = new Date(b.time || b.createdAt);
      return dateB - dateA;
    });

    const limitedNotifications = limit ? allNotifications.slice(0, limit) : allNotifications;

    console.log(`✅ Returning ${limitedNotifications.length} undelivered notifications`);

    return {
      notifications: limitedNotifications,
      meta: {
        total: limitedNotifications.length,
        since: fetchFromDate.toISOString(),
        normalCount: normalNotifications.length,
        specialCount: specialNotifications.length,
      }
    };

  } catch (error) {
    console.error('❌ Error fetching pending notifications:', error);
    throw error;
  }
};

const markNotificationAsDelivered = async (notificationId, uniqueCode) => {
  try {
    console.log(`✅ Marking notification ${notificationId} as delivered to ${uniqueCode}`);

    const result = await Notification.findByIdAndUpdate(
      notificationId,
      {
        $addToSet: {
          deliveredTo: {
            uniqueCode: uniqueCode,
            deliveredAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!result) {
      console.warn(`⚠️ Notification ${notificationId} not found`);
      return { success: false, message: 'Notification not found' };
    }

    return { success: true, message: 'Marked as delivered' };

  } catch (error) {
    console.error('❌ Error marking notification as delivered:', error);
    throw error;
  }
};

module.exports = {
  getAllNotificationsService,
  getPendingNotifications,
  markNotificationAsDelivered
};