const AttendanceSessionManager = require('../manager/attendance-session-manager');
const attendanceService = require('../services/attendance-service');
const PushNotificationService = require('../utils/push-notification-jobs');
const cron = require('node-cron');

// Add this helper function
const standardizeName = (name) => {
  if (!name) return '';

  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Add this helper function for time formatting
const formatTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';

  return `${hour12}:${minutes}${ampm}`;
};

// Add this helper function for date formatting
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dateOnly = dateString; // since dateOnly is already in YYYY-MM-DD format
  const todayString = today.toISOString().split('T')[0];
  const yesterdayString = yesterday.toISOString().split('T')[0];

  if (dateOnly === todayString) {
    return `today (${date.getDate()} ${months[date.getMonth()]})`;
  } else if (dateOnly === yesterdayString) {
    return `yesterday (${date.getDate()} ${months[date.getMonth()]})`;
  } else {
    return `on ${date.getDate()} ${months[date.getMonth()]}`;
  }
};

class LiveAttendanceMonitor {
  constructor() {
    this.sessionManager = new AttendanceSessionManager();
    this.isMonitoring = false;
    this.lastProcessedId = 0;

    // Employees to exclude
    this.excludedPins = ['1', '15'];
  }

  // Filter out excluded employees
  filterEmployees(data) {
    return data.filter(record => !this.excludedPins.includes(record.pin));
  }

  // Process new attendance records
  async processAttendanceData(attendanceData) {
    try {
      const filteredData = this.filterEmployees(attendanceData);
      const newRecords = [];

      for (const record of filteredData) {
        // Skip if we've already processed this record
        if (record.id <= this.lastProcessedId) {
          continue;
        }

        // Try to save the record
        const savedRecord = await attendanceService.addAttendance(record);

        if (savedRecord) {
          newRecords.push(savedRecord);
          console.log(`📝 New attendance: ${record.emp_name} punched ${savedRecord.punchType} at ${record.punch_time}`);
        }
      }

      // Update last processed ID
      if (attendanceData.length > 0) {
        this.lastProcessedId = Math.max(...attendanceData.map(r => r.id));
      }

      // Send notifications for new records
      await this.sendNotifications(newRecords);

      return {
        total: filteredData.length,
        new: newRecords.length,
        processed: newRecords
      };

    } catch (error) {
      console.error('❌ Error processing attendance data:', error);
      return {
        total: 0,
        new: 0,
        error: error.message
      };
    }
  }

  //  send Notifications method
  async sendNotifications(newRecords) {
    try {
      for (const record of newRecords) {
        const standardizedName = standardizeName(record.empName);
        const formattedTime = formatTime(record.timeOnly);
        const formattedDate = formatDate(record.dateOnly);

        const title = `${standardizedName} Punched ${record.punchType}`;
        const description = `${standardizedName} punched ${record.punchType.toLowerCase()} at ${formattedTime} ${formattedDate}`;

        await PushNotificationService.sendGeneralNotification(
          null, // broadcast to all users
          title,
          description,
          'high', // priority
          'attendance' // type
        );

        console.log(`🔔 Notification sent for ${standardizedName}`);
      }
    } catch (error) {
      console.error('❌ Error sending notifications:', error);
    }
  }

  // Single monitoring cycle
  async monitorCycle() {
    try {
      console.log('🔍 Checking for new attendance data...');

      const result = await this.sessionManager.getAttendanceData();

      if (!result.success) {
        console.error('❌ Failed to get attendance data:', result.error);
        return;
      }

      const processResult = await this.processAttendanceData(result.data);

      if (processResult.new > 0) {
        console.log(`✅ Processed ${processResult.new} new attendance records`);
      } else {
        console.log('ℹ️ No new attendance records');
      }

    } catch (error) {
      console.error('❌ Monitor cycle error:', error);
    }
  }

  // Start live monitoring
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring is already running');
      return;
    }

    console.log('🚀 Starting live attendance monitoring...');
    this.isMonitoring = true;

    // Run every 30 seconds
    this.monitorInterval = setInterval(async () => {
      await this.monitorCycle();
    }, 30000);

    // Also set up cron job for more reliable scheduling
    // Run every minute during working hours (7 AM to 8 PM)
    cron.schedule('* 7-20 * * 1-6', async () => {
      if (this.isMonitoring) {
        await this.monitorCycle();
      }
    }, {
      scheduled: true,
      timezone: "Asia/Qatar" // Adjust to your timezone
    });

    console.log('✅ Live monitoring started - checking every 30 seconds');
    console.log('✅ Cron job scheduled - every minute during working hours');
  }

  // Stop monitoring
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️ Monitoring is not running');
      return;
    }

    console.log('🛑 Stopping live attendance monitoring...');
    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    console.log('✅ Live monitoring stopped');
  }

  // Get monitoring status
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastProcessedId: this.lastProcessedId,
      sessionValid: this.sessionManager.isSessionValid(),
      excludedEmployees: this.excludedPins
    };
  }

  // Manual sync - process all data without notifications
  async manualSync() {
    try {
      console.log('🔄 Starting manual sync...');

      const result = await this.sessionManager.getAttendanceData();

      if (!result.success) {
        throw new Error('Failed to get attendance data: ' + result.error);
      }

      const filteredData = this.filterEmployees(result.data);
      let syncedCount = 0;

      for (const record of filteredData) {
        const savedRecord = await attendanceService.addAttendance(record);
        if (savedRecord) {
          syncedCount++;
        }
      }

      console.log(`✅ Manual sync completed - synced ${syncedCount} records`);
      return {
        success: true,
        syncedRecords: syncedCount,
        totalRecords: filteredData.length
      };

    } catch (error) {
      console.error('❌ Manual sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const liveMonitor = new LiveAttendanceMonitor();

// Auto-start monitoring when server starts
setTimeout(() => {
  liveMonitor.startMonitoring();
}, 5000); // Wait 5 seconds after server start

module.exports = liveMonitor;