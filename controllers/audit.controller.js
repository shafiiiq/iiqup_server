// controllers/dashboard.controller.js 
const mongoose            = require('mongoose');
const dashboardServices   = require('../services/dashboard-services');
const AuditLog            = require('../models/audit-log.model');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_PERIOD = (period) => ({
  period,
  activities:  [],
  summary:     { total: 0, creates: 0, updates: 0, deletes: 0 },
  byCollection: [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /dashboard/updates/daily
 * Returns audit activity aggregated for the current day.
 */
const getDailyUpdates = async (req, res) => {
  try {
    const result = await dashboardServices.fetchUpdates('daily');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getDailyUpdates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch daily updates', error: error.message });
  }
};

/**
 * GET /dashboard/updates/weekly
 * Returns audit activity aggregated for the current week.
 */
const getWeeklyUpdates = async (req, res) => {
  try {
    const result = await dashboardServices.fetchUpdates('weekly');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getWeeklyUpdates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly updates', error: error.message });
  }
};

/**
 * GET /dashboard/updates/monthly
 * Returns audit activity aggregated for the current month.
 */
const getMonthlyUpdates = async (req, res) => {
  try {
    const result = await dashboardServices.fetchUpdates('monthly');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getMonthlyUpdates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly updates', error: error.message });
  }
};

/**
 * GET /dashboard/updates/yearly
 * Returns audit activity aggregated for the current year.
 */
const getYearlyUpdates = async (req, res) => {
  try {
    const result = await dashboardServices.fetchUpdates('yearly');

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getYearlyUpdates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch yearly updates', error: error.message });
  }
};

/**
 * GET /dashboard/updates
 * Returns audit activity for all periods (daily, weekly, monthly, yearly) in one call.
 */
const getAllUpdates = async (req, res) => {
  try {
    const totalAuditLogs = await AuditLog.countDocuments();

    if (totalAuditLogs === 0) {
      return res.status(200).json({
        success: true,
        message: 'No audit logs found. Create or update some records to populate this data.',
        data:    {
          daily:   EMPTY_PERIOD('daily'),
          weekly:  EMPTY_PERIOD('weekly'),
          monthly: EMPTY_PERIOD('monthly'),
          yearly:  EMPTY_PERIOD('yearly'),
        },
      });
    }

    const [daily, weekly, monthly, yearly] = await Promise.all([
      dashboardServices.fetchUpdates('daily'),
      dashboardServices.fetchUpdates('weekly'),
      dashboardServices.fetchUpdates('monthly'),
      dashboardServices.fetchUpdates('yearly'),
    ]);

    res.status(200).json({
      success: true,
      message: 'All updates retrieved successfully',
      data:    {
        daily:   daily.data,
        weekly:  weekly.data,
        monthly: monthly.data,
        yearly:  yearly.data,
      },
    });
  } catch (error) {
    console.error('[Dashboard] getAllUpdates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all updates', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Audit & Analytics Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /dashboard/audit/:collectionName/:documentId
 * Returns the full audit history for a specific document.
 */
const getDocumentAuditHistory = async (req, res) => {
  try {
    const { documentId, collectionName } = req.params;
    const result = await dashboardServices.getDocumentHistory(documentId, collectionName);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getDocumentAuditHistory:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch document history', error: error.message });
  }
};

/**
 * GET /dashboard/analytics
 * Returns aggregated activity analytics across all collections.
 */
const getActivityAnalytics = async (req, res) => {
  try {
    const result = await dashboardServices.getActivityAnalytics();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Dashboard] getActivityAnalytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
  }
};

/**
 * GET /dashboard/realtime
 * Returns the 20 most recent audit log entries and an activity count for the past hour.
 */
const getRealtimeActivity = async (req, res) => {
  try {
    const recentActivity = await AuditLog.find().sort({ timestamp: -1 }).limit(20).lean();
    const oneHourAgo     = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount    = await AuditLog.countDocuments({ timestamp: { $gte: oneHourAgo } });

    res.status(200).json({
      success: true,
      message: 'Realtime activity retrieved successfully',
      data:    {
        recentActivity: recentActivity.map(log => ({
          id:           log._id,
          collection:   log.collectionName,
          action:       log.action,
          documentId:   log.documentId,
          timestamp:    log.timestamp,
          changesCount: log.changes?.length ?? 0,
        })),
        recentCount,
        lastUpdate: recentActivity[0]?.timestamp ?? null,
      },
    });
  } catch (error) {
    console.error('[Dashboard] getRealtimeActivity:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch realtime activity', error: error.message });
  }
};

/**
 * GET /dashboard/debug/audit-logs
 * Returns a diagnostic summary of all audit log records.
 */
const debugAuditLogs = async (req, res) => {
  try {
    const [totalLogs, recentLogs, collections, actions, collectionCounts] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.find().sort({ timestamp: -1 }).limit(10),
      AuditLog.distinct('collectionName'),
      AuditLog.distinct('action'),
      AuditLog.aggregate([
        { $group: { _id: '$collectionName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      message: 'Audit log diagnostics retrieved successfully',
      data:    {
        totalLogs,
        collections,
        actions,
        collectionCounts,
        recentLogs: recentLogs.map(log => ({
          id:           log._id,
          collection:   log.collectionName,
          action:       log.action,
          timestamp:    log.timestamp,
          documentId:   log.documentId,
          changesCount: log.changes?.length ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error('[Dashboard] debugAuditLogs:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit log diagnostics', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Test / Seed Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /dashboard/test/create-data
 * Creates sample equipment, service report, and document records to trigger audit logs.
 */
const createTestData = async (req, res) => {
  try {
    const Equipment     = require('../models/equip.model');
    const ServiceReport = require('../models/service-report.model');
    const Document      = require('../models/document.model');

    const testDataCreated = [];

    try {
      const saved = await new Equipment({
        name:         `Test Equipment ${Date.now()}`,
        type:         'Test Type',
        model:        'Test Model',
        serialNumber: `TEST-${Date.now()}`,
        status:       'active',
        purchaseDate: new Date(),
        vendor:       'Test Vendor',
      }).save();
      testDataCreated.push({ type: 'equipment', id: saved._id, name: saved.name });
    } catch (_) { /* model may not exist in all environments */ }

    try {
      const saved = await new ServiceReport({
        equipmentId:  new mongoose.Types.ObjectId(),
        title:        `Test Service Report ${Date.now()}`,
        description:  'Test service report',
        status:       'pending',
        reportDate:   new Date(),
      }).save();
      testDataCreated.push({ type: 'service-report', id: saved._id, title: saved.title });
    } catch (_) { /* model may not exist in all environments */ }

    try {
      const saved = await new Document({
        name:        `Test Document ${Date.now()}`,
        type:        'manual',
        description: 'Test document',
        uploadedBy:  new mongoose.Types.ObjectId(),
      }).save();
      testDataCreated.push({ type: 'document', id: saved._id, name: saved.name });
    } catch (_) { /* model may not exist in all environments */ }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const totalAuditLogs = await AuditLog.countDocuments();
    const recentLogs     = await AuditLog.find().sort({ timestamp: -1 }).limit(5);

    res.status(200).json({
      success: true,
      message: `Created ${testDataCreated.length} test item(s)`,
      data:    {
        testDataCreated,
        auditLogsCount: totalAuditLogs,
        recentAuditLogs: recentLogs.map(log => ({
          collection: log.collectionName,
          action:     log.action,
          documentId: log.documentId,
          timestamp:  log.timestamp,
        })),
      },
    });
  } catch (error) {
    console.error('[Dashboard] createTestData:', error);
    res.status(500).json({ success: false, message: 'Failed to create test data', error: error.message });
  }
};

/**
 * POST /dashboard/test/update-data
 * Updates existing equipment records to trigger UPDATE audit log entries.
 */
const updateTestData = async (req, res) => {
  try {
    const Equipment = require('../models/equip.model');
    const updates   = [];

    try {
      const equipments = await Equipment.find().limit(3);

      for (const equipment of equipments) {
        const updated = await Equipment.findByIdAndUpdate(
          equipment._id,
          { name: `Updated ${equipment.name} - ${Date.now()}`, updatedAt: new Date() },
          { new: true },
        );
        if (updated) updates.push({ type: 'equipment', id: updated._id, action: 'updated' });
      }
    } catch (_) { /* model may not exist in all environments */ }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const totalAuditLogs = await AuditLog.countDocuments();

    res.status(200).json({
      success: true,
      message: `Updated ${updates.length} item(s)`,
      data:    { updates, auditLogsCount: totalAuditLogs },
    });
  } catch (error) {
    console.error('[Dashboard] updateTestData:', error);
    res.status(500).json({ success: false, message: 'Failed to update test data', error: error.message });
  }
};

/**
 * POST /dashboard/test/create-audit-logs
 * Directly inserts 10 randomized audit log entries for testing purposes.
 */
const createTestAuditLogs = async (req, res) => {
  try {
    const collections = ['equipments', 'documents', 'toolkits', 'servicereports'];
    const actions     = ['CREATE', 'UPDATE', 'DELETE'];

    const testLogs = await Promise.all(
      Array.from({ length: 10 }, (_, i) => {
        const collection = collections[Math.floor(Math.random() * collections.length)];
        const action     = actions[Math.floor(Math.random() * actions.length)];

        return AuditLog.create({
          documentId:       new mongoose.Types.ObjectId(),
          collectionName:   collection,
          action,
          documentSnapshot: { testField: `Test data ${i + 1}`, createdAt: new Date() },
          changes:          action === 'UPDATE'
            ? [{ field: 'testField', oldValue: `Old value ${i}`, newValue: `New value ${i + 1}` }]
            : [],
          source:    'test-creation',
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        });
      }),
    );

    res.status(200).json({
      success: true,
      message: `Created ${testLogs.length} test audit log(s) successfully`,
      data:    testLogs.map(log => ({
        id:         log._id,
        collection: log.collectionName,
        action:     log.action,
        timestamp:  log.timestamp,
      })),
    });
  } catch (error) {
    console.error('[Dashboard] createTestAuditLogs:', error);
    res.status(500).json({ success: false, message: 'Failed to create test audit logs', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Updates
  getDailyUpdates,
  getWeeklyUpdates,
  getMonthlyUpdates,
  getYearlyUpdates,
  getAllUpdates,
  // Audit & Analytics
  getDocumentAuditHistory,
  getActivityAnalytics,
  getRealtimeActivity,
  debugAuditLogs,
  // Test / Seed
  createTestData,
  updateTestData,
  createTestAuditLogs,
};