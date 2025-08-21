// Add this to your dashboard routes or create a separate test route file

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/audit-log.model');
const mongoose = require('mongoose');

// Test route to manually create audit logs
router.post('/test-audit-create', async (req, res) => {
  try {    
    const testLog = await AuditLog.create({
      documentId: new mongoose.Types.ObjectId(),
      collectionName: 'test-collection',
      action: 'CREATE',
      documentSnapshot: {
        testField: 'test value',
        createdAt: new Date()
      },
      source: 'manual-test',
      timestamp: new Date()
    });
        
    res.json({
      status: 200,
      message: 'Test audit log created successfully',
      data: testLog
    });
  } catch (error) {
    console.error('❌ Error creating test audit log:', error);
    res.status(500).json({
      status: 500,
      error: error.message
    });
  }
});

// Test route to try creating a document in one of your collections
router.post('/test-collection-create', async (req, res) => {
  try {
    
    // Try to create a test document in the equipment collection
    const Equipment = require('../models/equip.model');
    
    const testEquipment = new Equipment({
      name: 'Test Equipment ' + Date.now(),
      type: 'Test Type',
      status: 'active',
      // Add other required fields based on your schema
    });
    
    const saved = await testEquipment.save();
    
    // Check if audit log was created
    setTimeout(async () => {
      const auditLogs = await AuditLog.find({ documentId: saved._id });
    }, 1000);
    
    res.json({
      status: 200,
      message: 'Test equipment created successfully',
      data: saved,
      note: 'Check console logs and audit logs'
    });
  } catch (error) {
    console.error('❌ Error creating test equipment:', error);
    res.status(500).json({
      status: 500,
      error: error.message
    });
  }
});

// Test route to update a document
router.post('/test-collection-update/:id', async (req, res) => {
  try {    
    const Equipment = require('../models/equip.model');
    
    const updated = await Equipment.findByIdAndUpdate(
      req.params.id,
      { 
        name: 'Updated Test Equipment ' + Date.now(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({
        status: 404,
        error: 'Equipment not found'
      });
    }
        
    // Check if audit log was created
    setTimeout(async () => {
      const auditLogs = await AuditLog.find({ documentId: updated._id });
    }, 1000);
    
    res.json({
      status: 200,
      message: 'Test equipment updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('❌ Error updating test equipment:', error);
    res.status(500).json({
      status: 500,
      error: error.message
    });
  }
});

module.exports = router;