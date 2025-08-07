// services/pushNotificationService.js
const userService = require('../services/user-services');
const { sendNotificationToUser: sendWebSocketNotification, broadcastNotification: broadcastWebSocketNotification } = require('../utils/websocket');
const User = require('../models/user.model');

/**
 * Enhanced Push Notification Service that handles both WebSocket and Push Notifications
 */
class PushNotificationService {

    /**
     * Send notification to user via both WebSocket and Push Notification
     * @param {string} uniqueCode - User's unique code
     * @param {object} notificationData - Notification data
     * @returns {object} Result object
     */
    static async sendNotificationToUser(uniqueCode, notificationData) {
        try {
            console.log(`📤 Sending notification to user ${uniqueCode}:`, notificationData.title);

            const results = {
                websocket: { success: false },
                pushNotification: { success: false }
            };

            // 1. Send via WebSocket (real-time)
            try {
                sendWebSocketNotification(uniqueCode, notificationData);
                results.websocket = { success: true, message: 'WebSocket notification sent' };
            } catch (error) {
                console.error('❌ WebSocket notification failed:', error);
                results.websocket = { success: false, error: error.message };
            }

            // 2. Send via Push Notification (for when app is closed/background)
            try {
                const pushResult = await userService.sendNotificationToUser(uniqueCode, notificationData);
                results.pushNotification = pushResult;
            } catch (error) {
                console.error('❌ Push notification failed:', error);
                results.pushNotification = { success: false, error: error.message };
            }

            // 3. Store in user's special notifications if it's a special type
            if (notificationData.type === 'special') {
                try {
                    await this.storeSpecialNotification(uniqueCode, notificationData);
                } catch (error) {
                    console.error('❌ Failed to store special notification:', error);
                }
            }

            const overallSuccess = results.websocket.success || results.pushNotification.success;

            return {
                success: overallSuccess,
                message: overallSuccess ? 'Notification sent successfully' : 'Failed to send notification',
                data: results
            };

        } catch (error) {
            console.error('❌ Error in sendNotificationToUser:', error);
            return {
                success: false,
                message: 'Failed to send notification',
                error: error.message
            };
        }
    }

    /**
     * Broadcast notification to all users
     * @param {object} notificationData - Notification data
     * @returns {object} Result object
     */
    static async broadcastNotification(notificationData) {
        try {
            console.log(`📢 Broadcasting notification:`, notificationData.title);

            const results = {
                websocket: { success: false },
                pushNotification: { success: false }
            };

            // 1. Broadcast via WebSocket
            try {
                broadcastWebSocketNotification(notificationData);
                results.websocket = { success: true, message: 'WebSocket broadcast sent' };
            } catch (error) {
                console.error('❌ WebSocket broadcast failed:', error);
                results.websocket = { success: false, error: error.message };
            }

            // 2. Send push notifications to all users
            try {
                const allUsers = await User.find({ isActive: true }).select('uniqueCode');
                const uniqueCodes = allUsers.map(user => user.uniqueCode);
                
                if (uniqueCodes.length > 0) {
                    const pushResult = await userService.sendBulkNotifications(uniqueCodes, notificationData);
                    results.pushNotification = pushResult;
                }
            } catch (error) {
                console.error('❌ Bulk push notification failed:', error);
                results.pushNotification = { success: false, error: error.message };
            }

            const overallSuccess = results.websocket.success || results.pushNotification.success;

            return {
                success: overallSuccess,
                message: overallSuccess ? 'Broadcast sent successfully' : 'Failed to send broadcast',
                data: results
            };

        } catch (error) {
            console.error('❌ Error in broadcastNotification:', error);
            return {
                success: false,
                message: 'Failed to broadcast notification',
                error: error.message
            };
        }
    }

    /**
     * Send notification to multiple specific users
     * @param {array} uniqueCodes - Array of user unique codes
     * @param {object} notificationData - Notification data
     * @returns {object} Result object
     */
    static async sendNotificationToUsers(uniqueCodes, notificationData) {
        try {
            if (!Array.isArray(uniqueCodes)) {
                throw new Error('uniqueCodes must be an array');
            }

            if (uniqueCodes.length === 0) {
                return {
                    success: false,
                    message: 'No user IDs provided'
                };
            }

            console.log(`📤 Sending notification to ${uniqueCodes.length} users:`, notificationData.title);

            const results = {
                websocket: { success: 0, failed: 0 },
                pushNotification: { success: 0, failed: 0 },
                details: []
            };

            // Process each user in parallel
            await Promise.all(uniqueCodes.map(async (uniqueCode) => {
                const userResult = {
                    uniqueCode,
                    websocket: { success: false },
                    pushNotification: { success: false }
                };

                // 1. Send via WebSocket
                try {
                    sendWebSocketNotification(uniqueCode, notificationData);
                    userResult.websocket = { success: true, message: 'WebSocket notification sent' };
                    results.websocket.success++;
                } catch (error) {
                    console.error(`❌ WebSocket notification failed for user ${uniqueCode}:`, error);
                    userResult.websocket = { success: false, error: error.message };
                    results.websocket.failed++;
                }

                // 2. Send via Push Notification
                try {
                    const pushResult = await userService.sendNotificationToUser(uniqueCode, notificationData);
                    userResult.pushNotification = pushResult;
                    if (pushResult.success) {
                        results.pushNotification.success++;
                    } else {
                        results.pushNotification.failed++;
                    }
                } catch (error) {
                    console.error(`❌ Push notification failed for user ${uniqueCode}:`, error);
                    userResult.pushNotification = { success: false, error: error.message };
                    results.pushNotification.failed++;
                }

                // 3. Store special notification if needed
                if (notificationData.type === 'special') {
                    try {
                        await this.storeSpecialNotification(uniqueCode, notificationData);
                    } catch (error) {
                        console.error(`❌ Failed to store special notification for user ${uniqueCode}:`, error);
                    }
                }

                results.details.push(userResult);
            }));

            const overallSuccess = results.websocket.success > 0 || results.pushNotification.success > 0;

            return {
                success: overallSuccess,
                message: overallSuccess ? 
                    `Notifications sent to ${results.websocket.success + results.pushNotification.success} users` : 
                    'Failed to send notifications',
                data: results
            };

        } catch (error) {
            console.error('❌ Error in sendNotificationToUsers:', error);
            return {
                success: false,
                message: 'Failed to send notifications',
                error: error.message
            };
        }
    }

    /**
     * Send stock alert notification
     * @param {string|array} uniqueCode - User's unique code or array of codes (null for broadcast)
     * @param {object} stockInfo - Stock information
     * @param {string} message - Custom message
     */
    static async sendStockAlert(uniqueCode, stockInfo, message) {
        const notification = {
            _id: `stock_${stockInfo._id}_${Date.now()}`,
            type: 'special',
            stockId: stockInfo._id,
            title: `Stock Alert: ${stockInfo.product}`,
            message: message || `Stock update for ${stockInfo.product}`,
            description: message || `Stock update for ${stockInfo.product}`,
            priority: stockInfo.stockCount < 10 ? 'high' : 'medium',
            time: new Date().toISOString(),
            stockInfo: stockInfo
        };

        if (Array.isArray(uniqueCode)) {
            return await this.sendNotificationToUsers(uniqueCode, notification);
        } else if (uniqueCode) {
            return await this.sendNotificationToUser(uniqueCode, notification);
        } else {
            return await this.broadcastNotification(notification);
        }
    }

    /**
     * Send equipment alert notification
     * @param {string|array} uniqueCode - User's unique code or array of codes (null for broadcast)
     * @param {object} equipmentInfo - Equipment information
     * @param {string} message - Custom message
     */
    static async sendEquipmentAlert(uniqueCode, equipmentInfo, message) {
        const notification = {
            _id: `equipment_${equipmentInfo._id}_${Date.now()}`,
            type: 'special',
            stockId: equipmentInfo._id,
            title: `Equipment Alert: ${equipmentInfo.equipmentName || equipmentInfo.product}`,
            message: message || `Equipment update for ${equipmentInfo.equipmentName || equipmentInfo.product}`,
            description: message || `Equipment update for ${equipmentInfo.equipmentName || equipmentInfo.product}`,
            priority: 'high',
            time: new Date().toISOString(),
            stockInfo: {
                ...equipmentInfo,
                type: 'equipment'
            }
        };

        if (Array.isArray(uniqueCode)) {
            return await this.sendNotificationToUsers(uniqueCode, notification);
        } else if (uniqueCode) {
            return await this.sendNotificationToUser(uniqueCode, notification);
        } else {
            return await this.broadcastNotification(notification);
        }
    }

    /**
     * Send general notification
     * @param {string|array} uniqueCode - User's unique code or array of codes (null for broadcast)
     * @param {string} title - Notification title
     * @param {string} description - Notification description
     * @param {string} priority - Notification priority
     * @param {string} type - Notification type
     */
    static async sendGeneralNotification(uniqueCode, title, description, priority = 'medium', type = 'normal') {
        const notification = {
            _id: `general_${Date.now()}`,
            type: type,
            title: title,
            description: description,
            message: description,
            priority: priority,
            time: new Date().toISOString()
        };

        if (Array.isArray(uniqueCode)) {
            return await this.sendNotificationToUsers(uniqueCode, notification);
        } else if (uniqueCode) {
            return await this.sendNotificationToUser(uniqueCode, notification);
        } else {
            return await this.broadcastNotification(notification);
        }
    }

    /**
     * Send maintenance reminder notification
     * @param {string|array} uniqueCode - User's unique code or array of codes (null for broadcast)
     * @param {object} maintenanceInfo - Maintenance information
     * @param {string} message - Custom message
     */
    static async sendMaintenanceReminder(uniqueCode, maintenanceInfo, message) {
        const notification = {
            _id: `maintenance_${maintenanceInfo._id}_${Date.now()}`,
            type: 'special',
            title: `Maintenance Reminder: ${maintenanceInfo.equipmentName || maintenanceInfo.title}`,
            message: message || `Scheduled maintenance for ${maintenanceInfo.equipmentName || maintenanceInfo.title}`,
            description: message || `Scheduled maintenance for ${maintenanceInfo.equipmentName || maintenanceInfo.title}`,
            priority: 'medium',
            time: new Date().toISOString(),
            maintenanceInfo: maintenanceInfo
        };

        if (Array.isArray(uniqueCode)) {
            return await this.sendNotificationToUsers(uniqueCode, notification);
        } else if (uniqueCode) {
            return await this.sendNotificationToUser(uniqueCode, notification);
        } else {
            return await this.broadcastNotification(notification);
        }
    }

    /**
     * Store special notification in user's record
     * @param {string} uniqueCode - User's unique code
     * @param {object} notificationData - Notification data
     */
    static async storeSpecialNotification(uniqueCode, notificationData) {
        try {
            const user = await User.findOne({ uniqueCode });
            
            if (!user) {
                throw new Error('User not found');
            }

            const specialNotification = {
                title: notificationData.title,
                description: notificationData.description || notificationData.message,
                time: new Date(notificationData.time || Date.now()),
                priority: notificationData.priority || 'medium',
                stockId: notificationData.stockId
            };

            user.specialNotification.push(specialNotification);
            
            if (user.specialNotification.length > 100) {
                user.specialNotification = user.specialNotification.slice(-100);
            }

            user.updatedAt = new Date();
            await user.save();

            console.log(`✅ Special notification stored for user ${uniqueCode}`);

        } catch (error) {
            console.error('❌ Error storing special notification:', error);
            throw error;
        }
    }

    /**
     * Send notification to users by role
     * @param {Array} roles - Array of user roles
     * @param {object} notificationData - Notification data
     */
    static async sendNotificationToRoles(roles, notificationData) {
        try {
            const users = await User.find({ 
                role: { $in: roles },
                isActive: true 
            }).select('uniqueCode');

            const uniqueCodes = users.map(user => user.uniqueCode);
            
            if (uniqueCodes.length === 0) {
                return {
                    success: false,
                    message: 'No users found with specified roles'
                };
            }

            return await this.sendNotificationToUsers(uniqueCodes, notificationData);

        } catch (error) {
            console.error('❌ Error sending notifications to roles:', error);
            return {
                success: false,
                message: 'Failed to send notifications to roles',
                error: error.message
            };
        }
    }

    /**
     * Get notification statistics
     * @returns {object} Statistics object
     */
    static async getNotificationStats() {
        try {
            const totalUsers = await User.countDocuments({ isActive: true });
            const usersWithTokens = await User.countDocuments({ 
                isActive: true,
                'pushTokens.0': { $exists: true }
            });

            const users = await User.find({ isActive: true }).select('pushTokens');
            const totalTokens = users.reduce((count, user) => {
                return count + (user.pushTokens ? user.pushTokens.length : 0);
            }, 0);

            return {
                success: true,
                data: {
                    totalUsers,
                    usersWithTokens,
                    totalTokens,
                    coverage: totalUsers > 0 ? Math.round((usersWithTokens / totalUsers) * 100) : 0
                }
            };

        } catch (error) {
            console.error('❌ Error getting notification stats:', error);
            return {
                success: false,
                message: 'Failed to get notification statistics',
                error: error.message
            };
        }
    }
}

module.exports = PushNotificationService;