const cron = require('node-cron');
const mechanicService = require('../services/mechanic-service');
const { checkIstimaraExpiry } = require('../middleware/istimara-expiry-middleware');
const liveMonitor = require('../jobs/attendance-cron-jobs'); 

/**
 * Setup cron jobs for the application
 * @returns {Object} Object with start method
 */
const setupCronJobs = () => {
  // Schedule cleanup of old overtime data to run at midnight on the 1st of every month
  const overtimeCleanupJob = cron.schedule('0 0 1 * *', async () => {
    console.log('Running scheduled monthly overtime cleanup job...');
    try {
      const result = await mechanicService.cleanupAllOldOvertimeData();
      console.log('Monthly overtime cleanup job completed:', result);
    } catch (error) {
      console.error('Error in monthly overtime cleanup job:', error);
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: "Asia/Qatar"
  });

  // Schedule calculation of monthly totals to run at 1 AM on the 1st of every month
  const monthlyTotalsJob = cron.schedule('0 1 1 * *', async () => {
    console.log('Running monthly overtime totals calculation...');
    try {
      // Fetch all mechanics
      const mechanicsResult = await mechanicService.fetchMechanic();

      if (!mechanicsResult.data || mechanicsResult.data.length === 0) {
        console.log('No mechanics found for monthly calculation');
        return;
      }

      const mechanics = mechanicsResult.data;
      let updatedCount = 0;

      // For each mechanic, recalculate their monthly totals
      for (const mechanic of mechanics) {
        // Only process mechanics with monthly overtime data
        if (mechanic.monthlyOvertime && mechanic.monthlyOvertime.length > 0) {
          // No need to manually recalculate totals - the pre-save hooks handle this
          // Just trigger a save to ensure all calculations are up to date
          await mechanicService.mechanicUpdate(mechanic._id, {
            // Using an empty update to trigger the pre-save hooks
            updatedAt: new Date()
          });
          updatedCount++;
        }
      }

      console.log(`Monthly totals calculation completed. Updated ${updatedCount} mechanics.`);
    } catch (error) {
      console.error('Error in monthly totals calculation job:', error);
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: "Asia/Qatar"
  });

  // Istimara Expiry Check - Run every day at 9:00 AM
  const istimaraExpiryJob = cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled Istimara expiry check at', new Date().toISOString());
    try {
      const result = await checkIstimaraExpiry();
      console.log('✅ Istimara expiry check completed:', result);
    } catch (error) {
      console.error('❌ Error in scheduled Istimara expiry check:', error);
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: "Asia/Qatar"
  });

  // Additional Istimara Expiry Check - Run every day at 6:00 PM as backup
  const istimaraExpiryBackupJob = cron.schedule('0 18 * * *', async () => {
    console.log('⏰ Running backup Istimara expiry check at', new Date().toISOString());
    try {
      const result = await checkIstimaraExpiry();
      console.log('✅ Backup Istimara expiry check completed:', result);
    } catch (error) {
      console.error('❌ Error in backup Istimara expiry check:', error);
    }
  }, {
    scheduled: false,
    timezone: "Asia/Qatar"
  });

  // Daily cleanup at midnight
  const dailyCleanupJob = cron.schedule('0 0 * * *', async () => {
    console.log('🧹 Running daily cleanup...');
    try {
      // Add cleanup logic here if needed
      console.log('Daily cleanup completed');
    } catch (error) {
      console.error('Error in daily cleanup:', error);
    }
  }, {
    timezone: "Asia/Qatar",
    scheduled: false
  });

  // Weekly report every Sunday at 6 PM
  const weeklyReportJob = cron.schedule('0 18 * * 0', async () => {
    console.log('📊 Generating weekly report...');
    try {
      // Add weekly report logic here
      console.log('Weekly report generation completed');
    } catch (error) {
      console.error('Error in weekly report generation:', error);
    }
  }, {
    timezone: "Asia/Qatar",
    scheduled: false
  });

  return {
    start: () => {
      console.log('🔧 Starting scheduled jobs...');

      try {
        // Start all jobs
        overtimeCleanupJob.start();
        monthlyTotalsJob.start();
        istimaraExpiryJob.start();
        istimaraExpiryBackupJob.start();
        dailyCleanupJob.start();
        weeklyReportJob.start();

        console.log('✅ All scheduled jobs started successfully');
        console.log('📅 Schedule Summary:');
        console.log('   - Overtime cleanup: 1st of every month at 12:00 AM (Qatar timezone)');
        console.log('   - Monthly totals calculation: 1st of every month at 1:00 AM (Qatar timezone)');
        console.log('   - Istimara expiry check: Daily at 9:00 AM (Qatar timezone)');
        console.log('   - Istimara expiry backup: Daily at 6:00 PM (Qatar timezone)');
        console.log('   - Daily cleanup: Daily at 12:00 AM (Qatar timezone)');
        console.log('   - Weekly report: Sundays at 6:00 PM (Qatar timezone)');

        // Optional: Start attendance monitoring after jobs are initialized
        setTimeout(() => {
          console.log('🚀 Server is ready for additional monitoring...');
          // liveMonitor.startMonitoring();
        }, 5000);

      } catch (error) {
        console.error('❌ Error starting scheduled jobs:', error);
        throw error;
      }
    },

    stop: () => {
      console.log('🛑 Stopping all scheduled jobs...');
      try {
        overtimeCleanupJob.stop();
        monthlyTotalsJob.stop();
        istimaraExpiryJob.stop();
        istimaraExpiryBackupJob.stop();
        dailyCleanupJob.stop();
        weeklyReportJob.stop();
        console.log('✅ All scheduled jobs stopped successfully');
      } catch (error) {
        console.error('❌ Error stopping scheduled jobs:', error);
      }
    },

    // Individual job controls for debugging/testing
    jobs: {
      overtimeCleanup: overtimeCleanupJob,
      monthlyTotals: monthlyTotalsJob,
      istimaraExpiry: istimaraExpiryJob,
      istimaraExpiryBackup: istimaraExpiryBackupJob,
      dailyCleanup: dailyCleanupJob,
      weeklyReport: weeklyReportJob
    },

    // Manual trigger methods for testing
    trigger: {
      overtimeCleanup: () => overtimeCleanupJob.fireOnTick(),
      monthlyTotals: () => monthlyTotalsJob.fireOnTick(),
      istimaraExpiry: () => istimaraExpiryJob.fireOnTick(),
      istimaraExpiryBackup: () => istimaraExpiryBackupJob.fireOnTick(),
      dailyCleanup: () => dailyCleanupJob.fireOnTick(),
      weeklyReport: () => weeklyReportJob.fireOnTick()
    }
  };
};

module.exports = setupCronJobs;