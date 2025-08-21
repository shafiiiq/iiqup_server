const Equipment = require('../models/equip.model.js');
const { createNotification } = require('../utils/notification-jobs.js');
const moment = require('moment');

/**
 * Check for Istimara expiry and send notifications:
 * - Weekly notifications starting one month before expiry
 * - Daily notifications in the last week before expiry
 */
const checkIstimaraExpiry = async () => {
  try {
    console.log('🔍 Starting Istimara expiry check...');
    const today = moment().startOf('day');
    
    // Find equipment with Istimara expiry data
    const expiringEquipment = await Equipment.find({
      istimaraExpiry: {
        $ne: "", // Not empty
        $exists: true
      }
    });

    console.log(`📊 Total equipment with Istimara expiry data: ${expiringEquipment.length}`);

    let notificationsSent = 0;
    let notificationsSkipped = 0;
    let notificationsFailed = 0;

    // Process each equipment with expiry date
    for (const equipment of expiringEquipment) {
      try {
        if (!equipment.istimaraExpiry) {
          notificationsSkipped++;
          continue;
        }

        // Parse the expiry date (handling multiple formats)
        let expiryDate;
        try {
          // Try to parse as ISO date (YYYY-MM-DD)
          if (moment(equipment.istimaraExpiry, moment.ISO_8601, true).isValid()) {
            expiryDate = moment(equipment.istimaraExpiry).startOf('day');
          }
          // Try to parse as DD/MM/YYYY
          else if (moment(equipment.istimaraExpiry, 'DD/MM/YYYY', true).isValid()) {
            expiryDate = moment(equipment.istimaraExpiry, 'DD/MM/YYYY').startOf('day');
          }
          // Try to parse as MM/DD/YYYY
          else if (moment(equipment.istimaraExpiry, 'MM/DD/YYYY', true).isValid()) {
            expiryDate = moment(equipment.istimaraExpiry, 'MM/DD/YYYY').startOf('day');
          }
          // Try to parse as DD-MM-YYYY
          else if (moment(equipment.istimaraExpiry, 'DD-MM-YYYY', true).isValid()) {
            expiryDate = moment(equipment.istimaraExpiry, 'DD-MM-YYYY').startOf('day');
          }
          // If we still couldn't parse, skip this equipment
          else {
            console.error(`⚠️ Could not parse expiry date for equipment ${equipment.regNo}: ${equipment.istimaraExpiry}`);
            notificationsSkipped++;
            continue;
          }
        } catch (parseError) {
          console.error(`⚠️ Error parsing date for equipment ${equipment.regNo}:`, parseError);
          notificationsSkipped++;
          continue;
        }

        // Calculate days until expiry
        const daysUntilExpiry = expiryDate.diff(today, 'days');

        // Skip if already expired
        if (daysUntilExpiry < 0) {
          notificationsSkipped++;
          continue;
        }

        // Determine if we should send a notification today
        let shouldNotify = false;
        let notificationType = '';
        let daysRemaining = daysUntilExpiry;

        // Daily notifications in the last week (7 days)
        if (daysUntilExpiry <= 7) {
          shouldNotify = true;
          notificationType = 'DAILY';
        }
        // Weekly notifications between 1 week and 1 month
        else if (daysUntilExpiry <= 30) {
          // Check if today is a notification day (every 7 days)
          if (daysUntilExpiry % 7 === 0 || daysUntilExpiry === 14 || daysUntilExpiry === 21) {
            shouldNotify = true;
            notificationType = 'WEEKLY';
          }
        }
        // Monthly notifications beyond 1 month
        else {
          // Check if today is exactly 30, 60, 90 days before expiry
          if (daysUntilExpiry === 30 || daysUntilExpiry === 60 || daysUntilExpiry === 90) {
            shouldNotify = true;
            notificationType = 'MONTHLY';
          }
        }

        if (!shouldNotify) {
          notificationsSkipped++;
          continue;
        }

        // Prepare notification message based on days remaining
        let message;
        if (daysUntilExpiry === 0) {
          message = `Istimara of ${equipment.machine} - ${equipment.regNo} expires TODAY! Urgent renewal required.`;
        } else if (daysUntilExpiry === 1) {
          message = `Istimara of ${equipment.machine} - ${equipment.regNo} expires TOMORROW! Urgent renewal required.`;
        } else if (daysUntilExpiry <= 7) {
          message = `Istimara of ${equipment.machine} - ${equipment.regNo} will expire in ${daysUntilExpiry} days. Please renew soon.`;
        } else if (daysUntilExpiry <= 30) {
          const weeksRemaining = Math.ceil(daysUntilExpiry / 7);
          message = `Istimara of ${equipment.machine} - ${equipment.regNo} will expire in ${weeksRemaining} week${weeksRemaining > 1 ? 's' : ''}. Consider renewal.`;
        } else {
          const monthsRemaining = Math.ceil(daysUntilExpiry / 30);
          message = `Istimara of ${equipment.machine} - ${equipment.regNo} will expire in ${monthsRemaining} month${monthsRemaining > 1 ? 's' : ''}. Plan for renewal.`;
        }

        const notificationData = {
          title: "Istimara Expiry Alert",
          description: message,
          priority: daysUntilExpiry <= 7 ? "HIGH" : "MEDIUM",
          sourceId: equipment.id.toString(),
          metadata: {
            equipmentId: equipment.id,
            regNo: equipment.regNo,
            expiryDate: expiryDate.format('YYYY-MM-DD'),
            daysRemaining: daysUntilExpiry,
            notificationType: notificationType
          }
        };

        // Send notification
        const result = await createNotification(notificationData);

        await PushNotificationService.sendGeneralNotification(
          null, // broadcast to all users
          "Istimara Expiry Alert", // title
          `${message},\nExpiry date : ${expiryDate.format('YYYY-MM-DD')}`, // description
          daysUntilExpiry <= 7 ? "HIGH" : "MEDIUM", // priority
          notificationType == 'MONTHLY' ? 'high' 
          : notificationType == 'WEEKLY' ? 'medium'
          : 'normal' // type
        );
        
        if (result.success) {
          notificationsSent++;
          
          // Send real-time notification via WebSocket if available
          if (global.io) {
            global.io.emit('notification', {
              type: 'istimara_expiry',
              data: notificationData,
              equipment: {
                machine: equipment.machine,
                regNo: equipment.regNo,
                expiryDate: expiryDate.format('YYYY-MM-DD'),
                id: equipment.id
              },
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.error(`❌ Failed to send notification for equipment ${equipment.regNo}:`, result.error);
          notificationsFailed++;
        }
      } catch (error) {
        console.error(`❌ Error processing equipment ${equipment.regNo}:`, error);
        notificationsFailed++;
      }
    }

    const summary = {
      success: true,
      message: `Istimara expiry check completed. ${notificationsSent} notifications sent, ${notificationsSkipped} skipped, ${notificationsFailed} failed.`,
      equipmentChecked: expiringEquipment.length,
      notificationsSent: notificationsSent,
      notificationsSkipped: notificationsSkipped,
      notificationsFailed: notificationsFailed,
      checkDate: today.format('YYYY-MM-DD'),
    };

    console.log('📈 Istimara expiry check summary:', summary);
    return summary;

  } catch (error) {
    console.error('❌ Critical error in checkIstimaraExpiry:', error);
    return {
      success: false,
      error: error.message,
      message: 'Critical failure in Istimara expiry check',
      timestamp: new Date().toISOString()
    };
  }
};

// Middleware function remains the same
const istimaraExpiryMiddleware = async (req, res, next) => {
  try {
    console.log('🔄 Running Istimara expiry check middleware...');
    const result = await checkIstimaraExpiry();
    
    if (req && res) {
      return res.status(result.success ? 200 : 500).json({
        timestamp: new Date().toISOString(),
        ...result
      });
    } else {
      console.log('📊 Istimara expiry middleware completed:', result.success ? '✅ SUCCESS' : '❌ FAILED');
      if (next) next();
      return result;
    }
  } catch (error) {
    console.error('❌ Error in istimaraExpiryMiddleware:', error);
    
    if (req && res) {
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to check Istimara expiry',
        timestamp: new Date().toISOString()
      });
    } else {
      if (next) next(error);
      throw error;
    }
  }
};

module.exports = {
  checkIstimaraExpiry,
  istimaraExpiryMiddleware
};