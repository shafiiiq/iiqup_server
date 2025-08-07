const express = require('express');
const router = express.Router();
const AuditLog = require('../models/audit-log.model');

// GET /audit/logs - Get all audit logs with pagination
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Optional filters
    const filters = {};
    if (req.query.collection) {
      filters.collectionName = req.query.collection;
    }
    if (req.query.action) {
      filters.action = req.query.action;
    }
    if (req.query.documentId) {
      filters.documentId = req.query.documentId;
    }
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filters.timestamp = {};
      if (req.query.startDate) {
        filters.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    const auditLogs = await AuditLog.find(filters)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalCount = await AuditLog.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      status: 200,
      data: {
        logs: auditLogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch audit logs',
      details: error.message
    });
  }
});

// GET /audit/collections - Get distinct collection names
router.get('/collections', async (req, res) => {
  try {
    const collections = await AuditLog.distinct('collectionName');
    res.json({
      status: 200,
      data: collections
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch collections'
    });
  }
});

// GET /audit/actions - Get distinct actions
router.get('/actions', async (req, res) => {
  try {
    const actions = await AuditLog.distinct('action');
    res.json({
      status: 200,
      data: actions
    });
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch actions'
    });
  }
});

// GET /audit/document/:documentId - Get audit history for specific document
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const auditLogs = await AuditLog.find({ documentId })
      .sort({ timestamp: -1 })
      .lean();
    
    res.json({
      status: 200,
      data: {
        documentId,
        history: auditLogs
      }
    });
  } catch (error) {
    console.error('Error fetching document audit history:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch document audit history'
    });
  }
});

// GET /audit/stats - Get audit statistics
router.get('/stats', async (req, res) => {
  try {
    const totalLogs = await AuditLog.countDocuments();
    
    // Get stats by action
    const actionStats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get stats by collection
    const collectionStats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$collectionName',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await AuditLog.countDocuments({
      timestamp: { $gte: yesterday }
    });
    
    res.json({
      status: 200,
      data: {
        totalLogs,
        recentActivity,
        actionStats,
        collectionStats
      }
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to fetch audit statistics'
    });
  }
});

// POST /audit/search - Advanced search for audit logs
router.post('/search', async (req, res) => {
  try {
    const {
      collections = [],
      actions = [],
      startDate,
      endDate,
      searchTerm,
      page = 1,
      limit = 20
    } = req.body;
    
    const skip = (page - 1) * limit;
    const filters = {};
    
    // Collection filter
    if (collections.length > 0) {
      filters.collectionName = { $in: collections };
    }
    
    // Action filter
    if (actions.length > 0) {
      filters.action = { $in: actions };
    }
    
    // Date range filter
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) {
        filters.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filters.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Search term filter (searches in document snapshot)
    if (searchTerm) {
      filters.$or = [
        { 'documentSnapshot': { $regex: searchTerm, $options: 'i' } },
        { 'changes.field': { $regex: searchTerm, $options: 'i' } },
        { 'changes.oldValue': { $regex: searchTerm, $options: 'i' } },
        { 'changes.newValue': { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    const auditLogs = await AuditLog.find(filters)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalCount = await AuditLog.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      status: 200,
      data: {
        logs: auditLogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          collections,
          actions,
          startDate,
          endDate,
          searchTerm
        }
      }
    });
  } catch (error) {
    console.error('Error searching audit logs:', error);
    res.status(500).json({
      status: 500,
      error: 'Failed to search audit logs',
      details: error.message
    });
  }
});

module.exports = router;