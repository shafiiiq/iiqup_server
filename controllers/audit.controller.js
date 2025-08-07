const dashboardServices = require('../services/dashboard-services');
const AuditLog = require('../models/audit-log.model');
const mongoose = require('mongoose');

async function getDailyUpdates(req, res) {
  try {
    const result = await dashboardServices.fetchUpdates('daily');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getDailyUpdates:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch daily updates' });
  }
}

async function getWeeklyUpdates(req, res) {
  try {
    const result = await dashboardServices.fetchUpdates('weekly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getWeeklyUpdates:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch weekly updates' });
  }
}

async function getMonthlyUpdates(req, res) {
  try {
    const result = await dashboardServices.fetchUpdates('monthly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getMonthlyUpdates:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch monthly updates' });
  }
}

async function getYearlyUpdates(req, res) {
  try {
    const result = await dashboardServices.fetchUpdates('yearly');
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getYearlyUpdates:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch yearly updates' });
  }
}

async function getAllUpdates(req, res) {
  try {
    // Debug: Check if there are any audit logs at all
    const totalAuditLogs = await AuditLog.countDocuments();
    console.log(`📊 Total audit logs in database: ${totalAuditLogs}`);
    
    if (totalAuditLogs === 0) {
      return res.status(200).json({
        status: 200,
        message: 'No audit logs found in database. Try creating/updating some data first or use the create-test-data endpoint.',
        data: {
          daily: { period: 'daily', activities: [], summary: { total: 0, creates: 0, updates: 0, deletes: 0 }, byCollection: [] },
          weekly: { period: 'weekly', activities: [], summary: { total: 0, creates: 0, updates: 0, deletes: 0 }, byCollection: [] },
          monthly: { period: 'monthly', activities: [], summary: { total: 0, creates: 0, updates: 0, deletes: 0 }, byCollection: [] },
          yearly: { period: 'yearly', activities: [], summary: { total: 0, creates: 0, updates: 0, deletes: 0 }, byCollection: [] }
        },
        debug: {
          totalAuditLogs: totalAuditLogs,
          message: 'No audit data available yet - try POST /dashboard/create-test-data to generate sample data'
        }
      });
    }

    // Debug: Show recent audit logs
    const recentLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(5);
    console.log('📋 Recent audit logs:', recentLogs.map(log => ({
      collection: log.collectionName,
      action: log.action,
      timestamp: log.timestamp,
      documentId: log.documentId
    })));

    const [daily, weekly, monthly, yearly] = await Promise.all([
      dashboardServices.fetchUpdates('daily'),
      dashboardServices.fetchUpdates('weekly'),
      dashboardServices.fetchUpdates('monthly'),
      dashboardServices.fetchUpdates('yearly')
    ]);

    console.log('📈 Fetched updates:', {
      daily: daily.data?.summary || 'no data',
      weekly: weekly.data?.summary || 'no data',
      monthly: monthly.data?.summary || 'no data',
      yearly: yearly.data?.summary || 'no data'
    });

    res.status(200).json({
      status: 200,
      data: {
        daily: daily.data,
        weekly: weekly.data,
        monthly: monthly.data,
        yearly: yearly.data
      },
      debug: {
        totalAuditLogs: totalAuditLogs,
        recentActivity: recentLogs.length
      }
    });
  } catch (error) {
    console.error('❌ Error in getAllUpdates:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch all updates',
      details: error.message
    });
  }
}

async function getDocumentAuditHistory(req, res) {
  try {
    const { documentId, collectionName } = req.params;
    const result = await dashboardServices.getDocumentHistory(documentId, collectionName);
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getDocumentAuditHistory:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch document history' });
  }
}

async function getActivityAnalytics(req, res) {
  try {
    const result = await dashboardServices.getActivityAnalytics();
    res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in getActivityAnalytics:', error);
    res.status(500).json({ status: 500, error: 'Failed to fetch analytics' });
  }
}

async function getRealtimeActivity(req, res) {
  try {
    // Get the most recent 20 audit logs
    const recentActivity = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    // Get activity in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await AuditLog.countDocuments({
      timestamp: { $gte: oneHourAgo }
    });

    res.status(200).json({
      status: 200,
      data: {
        recentActivity: recentActivity.map(log => ({
          id: log._id,
          collection: log.collectionName,
          action: log.action,
          documentId: log.documentId,
          timestamp: log.timestamp,
          changesCount: log.changes ? log.changes.length : 0
        })),
        recentCount,
        lastUpdate: recentActivity[0]?.timestamp || null
      }
    });
  } catch (error) {
    console.error('Error in getRealtimeActivity:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch realtime activity'
    });
  }
}

// Debug endpoint to check audit logs
async function debugAuditLogs(req, res) {
  try {
    const totalLogs = await AuditLog.countDocuments();
    const recentLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(10);
    const collections = await AuditLog.distinct('collectionName');
    const actions = await AuditLog.distinct('action');
    
    // Get counts by collection
    const collectionCounts = await AuditLog.aggregate([
      {
        $group: {
          _id: '$collectionName',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      status: 200,
      debug: {
        totalLogs,
        collections,
        actions,
        collectionCounts,
        recentLogs: recentLogs.map(log => ({
          id: log._id,
          collection: log.collectionName,
          action: log.action,
          timestamp: log.timestamp,
          documentId: log.documentId,
          changesCount: log.changes ? log.changes.length : 0
        }))
      }
    });
  } catch (error) {
    console.error('Error in debugAuditLogs:', error);
    res.status(500).json({
      status: 500,
      error: error.message
    });
  }
}

// Function to create test data that will trigger audit logs
async function createTestData(req, res) {
  try {
    console.log('🧪 Creating test data to trigger audit logs...');
    
    const testDataCreated = [];
    
    // Test Equipment creation
    try {
      const Equipment = require('../models/equip.model');
      const testEquipment = new Equipment({
        name: `Test Equipment ${Date.now()}`,
        type: 'Test Type',
        model: 'Test Model',
        serialNumber: `TEST-${Date.now()}`,
        status: 'active',
        purchaseDate: new Date(),
        vendor: 'Test Vendor'
      });
      
      const savedEquipment = await testEquipment.save();
      testDataCreated.push({ type: 'equipment', id: savedEquipment._id, name: savedEquipment.name });
      console.log('✅ Test equipment created:', savedEquipment._id);
    } catch (error) {
      console.log('⚠️  Equipment creation failed:', error.message);
    }
    
    // Test Service Report creation
    try {
      const ServiceReport = require('../models/service-report.model');
      const testServiceReport = new ServiceReport({
        equipmentId: new mongoose.Types.ObjectId(),
        title: `Test Service Report ${Date.now()}`,
        description: 'This is a test service report',
        status: 'pending',
        reportDate: new Date()
      });
      
      const savedReport = await testServiceReport.save();
      testDataCreated.push({ type: 'service-report', id: savedReport._id, title: savedReport.title });
      console.log('✅ Test service report created:', savedReport._id);
    } catch (error) {
      console.log('⚠️  Service report creation failed:', error.message);
    }
    
    // Test Document creation
    try {
      const Document = require('../models/document.model');
      const testDocument = new Document({
        name: `Test Document ${Date.now()}`,
        type: 'manual',
        description: 'This is a test document',
        uploadedBy: new mongoose.Types.ObjectId()
      });
      
      const savedDocument = await testDocument.save();
      testDataCreated.push({ type: 'document', id: savedDocument._id, name: savedDocument.name });
      console.log('✅ Test document created:', savedDocument._id);
    } catch (error) {
      console.log('⚠️  Document creation failed:', error.message);
    }
    
    // Wait a moment for audit logs to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check audit logs
    const totalAuditLogs = await AuditLog.countDocuments();
    const recentLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(5);
    
    console.log(`📊 Total audit logs after test data creation: ${totalAuditLogs}`);
    
    res.json({
      status: 200,
      message: `Created ${testDataCreated.length} test items`,
      data: {
        testDataCreated,
        auditLogsCount: totalAuditLogs,
        recentAuditLogs: recentLogs.map(log => ({
          collection: log.collectionName,
          action: log.action,
          documentId: log.documentId,
          timestamp: log.timestamp
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to create test data',
      details: error.message
    });
  }
}

// Test updating data
async function updateTestData(req, res) {
  try {
    console.log('🧪 Updating test data to trigger audit logs...');
    
    const updates = [];
    
    // Find and update some equipment
    try {
      const Equipment = require('../models/equip.model');
      const equipments = await Equipment.find().limit(3);
      
      for (const equipment of equipments) {
        const updated = await Equipment.findByIdAndUpdate(
          equipment._id,
          { 
            name: `Updated ${equipment.name} - ${Date.now()}`,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (updated) {
          updates.push({ type: 'equipment', id: updated._id, action: 'updated' });
          console.log('✅ Updated equipment:', updated._id);
        }
      }
    } catch (error) {
      console.log('⚠️  Equipment update failed:', error.message);
    }
    
    // Wait for audit logs
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const totalAuditLogs = await AuditLog.countDocuments();
    console.log(`📊 Total audit logs after updates: ${totalAuditLogs}`);
    
    res.json({
      status: 200,
      message: `Updated ${updates.length} items`,
      data: {
        updates,
        auditLogsCount: totalAuditLogs
      }
    });
  } catch (error) {
    console.error('❌ Error updating test data:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to update test data',
      details: error.message
    });
  }
}

// Function to manually create test audit logs directly
async function createTestAuditLogs(req, res) {
  try {
    const testLogs = [];
    const collections = ['equipments', 'documents', 'toolkits', 'servicereports'];
    const actions = ['CREATE', 'UPDATE', 'DELETE'];
    
    // Create 10 test audit logs
    for (let i = 0; i < 10; i++) {
      const randomCollection = collections[Math.floor(Math.random() * collections.length)];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      
      const testLog = await AuditLog.create({
        documentId: new mongoose.Types.ObjectId(),
        collectionName: randomCollection,
        action: randomAction,
        documentSnapshot: {
          testField: `Test data ${i + 1}`,
          createdAt: new Date()
        },
        changes: randomAction === 'UPDATE' ? [
          {
            field: 'testField',
            oldValue: `Old value ${i}`,
            newValue: `New value ${i + 1}`
          }
        ] : [],
        source: 'test-creation',
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time in last 7 days
      });
      
      testLogs.push(testLog);
    }
    
    console.log(`✅ Created ${testLogs.length} test audit logs`);
    
    res.json({
      status: 200,
      message: `Created ${testLogs.length} test audit logs successfully`,
      data: testLogs.map(log => ({
        id: log._id,
        collection: log.collectionName,
        action: log.action,
        timestamp: log.timestamp
      }))
    });
  } catch (error) {
    console.error('❌ Error creating test audit logs:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to create test audit logs',
      details: error.message
    });
  }
}

module.exports = {
  getDailyUpdates,
  getWeeklyUpdates,
  getMonthlyUpdates,
  getYearlyUpdates,
  getAllUpdates,
  getDocumentAuditHistory,
  getActivityAnalytics,
  getRealtimeActivity,
  debugAuditLogs,
  createTestData,
  updateTestData,
  createTestAuditLogs  // Added this function
};