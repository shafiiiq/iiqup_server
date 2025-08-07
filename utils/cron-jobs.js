const cron = require('node-cron');
const mechanicService = require('../services/mechanic-service');
const { checkIstimaraExpiry } = require('../middleware/istimara-expiry-middleware');

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
    scheduled: false // Don't start automatically
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
    scheduled: false // Don't start automatically
  });

  // NEW: Istimara Expiry Check - Run every day at 9:00 AM
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
    timezone: "Asia/Qatar" // Adjust timezone as needed
  });

  // NEW: Additional Istimara Expiry Check - Run every day at 6:00 PM as backup
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

  return {
    start: () => {
      console.log('Starting scheduled jobs...');
      
      // Start existing jobs
      overtimeCleanupJob.start();
      monthlyTotalsJob.start();
      
      // Start new Istimara expiry checking jobs
      istimaraExpiryJob.start();
      istimaraExpiryBackupJob.start();
      
      console.log('Scheduled jobs started');
      console.log('📅 Istimara expiry check scheduled for: 9:00 AM and 6:00 PM daily (Qatar timezone)');
      console.log('📅 Overtime cleanup scheduled for: 1st of every month at midnight');
      console.log('📅 Monthly totals calculation scheduled for: 1st of every month at 1:00 AM');
    },
    
    // Optional: Add individual job controls for debugging/testing
    jobs: {
      overtimeCleanup: overtimeCleanupJob,
      monthlyTotals: monthlyTotalsJob,
      istimaraExpiry: istimaraExpiryJob,
      istimaraExpiryBackup: istimaraExpiryBackupJob
    }
  };
};

module.exports = setupCronJobs;