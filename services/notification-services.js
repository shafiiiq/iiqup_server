// Import your Notification model
const Notification = require('../models/notification-model'); // Adjust path as needed
const User = require('../models/user.model');

const getAllNotificationsService = async (uniqueCode) => {
  try {
    const allowedRoles = [
      process.env.MAINTENANCE_HEAD,
      process.env.WORKSHOP_MANAGER,
      process.env.SUPER_ADMIN
    ];

     const adminRoles = [
      process.env.SUPER_ADMIN
    ];

    // Fetch all notifications from the database
    let notifications = await Notification.find();

    // If uniqueCode is NOT in allowed roles, filter out attendance notifications
    if (!allowedRoles.includes(uniqueCode)) {
      notifications = notifications.filter(
        notification => notification.sourceId !== 'attendance'
      );
    }
    
    if (!adminRoles.includes(uniqueCode)) {
      notifications = notifications.filter(
        notification => notification.sourceId !== 'login_attemps'
      );
    }

    return notifications;
  } catch (error) {
    console.error('Error in getAllNotificationsService:', error);
    throw new Error('Failed to retrieve notifications from database');
  }
};

const getPendingNotifications = async (uniqueCode, since, limit = 100) => {
  try {

    if (!uniqueCode) {
      throw new Error('uniqueCode is required');
    }

    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const fetchFromDate = sevenDaysAgo;

    // ✅ UPDATED QUERY: Check if user is in targetUsers OR it's a broadcast
    const normalNotifications = await Notification.find({
      createdAt: { $gte: fetchFromDate },

      // ✅ NEW LOGIC: Only fetch if:
      // 1. It's a broadcast (isBroadcast: true)
      // 2. OR user is in targetUsers array
      // 3. AND user hasn't received it yet
      $or: [
        { isBroadcast: true }, // Broadcast to all
        { targetUsers: uniqueCode } // User is in target list
      ],
      'deliveredTo.uniqueCode': { $ne: uniqueCode } // Not delivered yet
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    console.log(`📢 Found ${normalNotifications.length} undelivered notifications for ${uniqueCode}`);

    // Fetch special notifications (same as before)
    const user = await User.findOne({ uniqueCode }).select('specialNotification');

    let specialNotifications = [];
    if (user && user.specialNotification) {
      specialNotifications = user.specialNotification.filter(notif => {
        const notifDate = new Date(notif.time || notif.createdAt);
        return notifDate >= fetchFromDate;
      });
    }

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

    const limitedNotifications = allNotifications.slice(0, limit);

    console.log(`✅ Returning ${limitedNotifications.length} notifications`);

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
    console.error('❌ Error:', error);
    throw error;
  }
};

// const getPendingNotifications = async (uniqueCode, since, limit = 100) => {
//   try {
//     console.log('📬 Fetching pending notifications...');
//     console.log('User:', uniqueCode);

//     if (!uniqueCode) {
//       throw new Error('uniqueCode is required');
//     }

//     // ⚠️ TEMPORARY FIX - REMOVE THIS IN FUTURE (After December 2025)
//     // This cutoff date prevents fetching old notifications that were sent
//     // before the "mark as read" and "pending notification" features were implemented.
//     // Once all users are on track (after a few weeks), remove this and use only sevenDaysAgo logic.
//     const TEMPORARY_CUTOFF_DATE = new Date('2025-10-21T09:00:00.000Z'); // October 21, 2025, 9:00 AM UTC

//     const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

//     // Use the LATER date between cutoff and 7 days ago
//     // This ensures we never fetch notifications before October 21, 2024, 9 PM
//     const fetchFromDate = TEMPORARY_CUTOFF_DATE > sevenDaysAgo ? TEMPORARY_CUTOFF_DATE : sevenDaysAgo;

//     console.log(`📅 Fetching from: ${fetchFromDate.toISOString()}`);
//     console.log(`⚠️ Using temporary cutoff: ${TEMPORARY_CUTOFF_DATE.toISOString()} (REMOVE IN FUTURE)`);

//     // ✅ UPDATED QUERY: Check if user is in targetUsers OR it's a broadcast
//     const normalNotifications = await Notification.find({
//       createdAt: { $gte: fetchFromDate },

//       // ✅ NEW LOGIC: Only fetch if:
//       // 1. It's a broadcast (isBroadcast: true)
//       // 2. OR user is in targetUsers array
//       // 3. AND user hasn't received it yet
//       $or: [
//         { isBroadcast: true }, // Broadcast to all
//         { targetUsers: uniqueCode } // User is in target list
//       ],
//       'deliveredTo.uniqueCode': { $ne: uniqueCode } // Not delivered yet
//     })
//       .sort({ createdAt: -1 })
//       .limit(limit)
//       .lean();

//     console.log(`📢 Found ${normalNotifications.length} undelivered notifications for ${uniqueCode}`);

//     // Fetch special notifications (same as before)
//     const user = await User.findOne({ uniqueCode }).select('specialNotification');

//     let specialNotifications = [];
//     if (user && user.specialNotification) {
//       specialNotifications = user.specialNotification.filter(notif => {
//         const notifDate = new Date(notif.time || notif.createdAt);

//         // ⚠️ TEMPORARY FIX - REMOVE IN FUTURE
//         // Apply the same cutoff date for special notifications
//         return notifDate >= fetchFromDate;
//       });
//     }

//     console.log(`⭐ Found ${specialNotifications.length} special notifications`);

//     // Combine all notifications
//     const allNotifications = [
//       ...normalNotifications.map(n => ({
//         ...n,
//         type: 'normal',
//         _id: n._id.toString(),
//         time: n.createdAt || n.time,
//       })),
//       ...specialNotifications.map(n => ({
//         ...n,
//         type: 'special',
//         _id: n._id ? n._id.toString() : `special_${Date.now()}_${Math.random()}`,
//         time: n.time || n.createdAt,
//       }))
//     ];

//     // Sort by time
//     allNotifications.sort((a, b) => {
//       const dateA = new Date(a.time || a.createdAt);
//       const dateB = new Date(b.time || b.createdAt);
//       return dateB - dateA;
//     });

//     const limitedNotifications = allNotifications.slice(0, limit);

//     console.log(`✅ Returning ${limitedNotifications.length} notifications`);

//     return {
//       notifications: limitedNotifications,
//       meta: {
//         total: limitedNotifications.length,
//         since: fetchFromDate.toISOString(),
//         normalCount: normalNotifications.length,
//         specialCount: specialNotifications.length,
//         // ⚠️ TEMPORARY - REMOVE IN FUTURE
//         usingTemporaryCutoff: fetchFromDate.getTime() === TEMPORARY_CUTOFF_DATE.getTime()
//       }
//     };

//   } catch (error) {
//     console.error('❌ Error:', error);
//     throw error;
//   }
// };

// ⚠️⚠️⚠️ IMPORTANT REMINDER ⚠️⚠️⚠️
// TODO: REMOVE TEMPORARY_CUTOFF_DATE logic after December 2025
// Once all users have received and cleared old notifications,
// revert to using only the 7-days-ago logic.
// 
// Steps to remove:
// 1. Delete the TEMPORARY_CUTOFF_DATE constant
// 2. Change: const fetchFromDate = sevenDaysAgo;
// 3. Remove all comments marked with "TEMPORARY FIX - REMOVE IN FUTURE"
// 4. Remove the usingTemporaryCutoff field from meta object

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