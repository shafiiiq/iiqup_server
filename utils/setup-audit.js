const { createAuditMiddleware } = require('../middleware/audit-middleware');
const mongoose = require('mongoose');

function setupAuditTracking() {
  console.log('🔧 Starting audit tracking setup...');
  
  try {
    // Define model paths and their collection names
    const modelConfigs = [
      { path: '../models/service-history.model', collection: 'service-history' },
      { path: '../models/service-report.model', collection: 'service-report' },
      { path: '../models/maintanance-history.model', collection: 'maintanance-history' },
      { path: '../models/tyre.model', collection: 'tyre' },
      { path: '../models/batery.model', collection: 'battery' },
      { path: '../models/equip-hand-over-stock.model', collection: 'equip-hand-over-stock' },
      { path: '../models/equip.model', collection: 'equipment' },
      { path: '../models/document.model', collection: 'document' },
      { path: '../models/toolkit.model', collection: 'toolkit' }
    ];

    modelConfigs.forEach(config => {
      try {
        console.log(`🔍 Loading model: ${config.path}`);
        const Model = require(config.path);
        
        if (Model && Model.schema) {
          // Get the actual collection name from the model
          const actualCollectionName = Model.collection.name;
          console.log(`📝 Model collection name: ${actualCollectionName}`);
          
          // Apply audit middleware
          Model.schema.plugin(createAuditMiddleware(actualCollectionName));
          console.log(`✅ Audit tracking enabled for ${actualCollectionName}`);
        } else {
          console.warn(`⚠️  Model ${config.path} does not have a schema`);
        }
      } catch (error) {
        console.error(`❌ Error loading model ${config.path}:`, error.message);
      }
    });
    
    console.log('✅ Audit tracking setup completed successfully');
  } catch (error) {
    console.error('❌ Error in setupAuditTracking:', error);
  }
}

// Fixed test function with proper ObjectId usage
async function testAuditLogging() {
  try {
    console.log('🧪 Testing audit logging...');
    const AuditLog = require('../models/audit-log.model');
    
    // Create a test audit log with proper ObjectId instantiation
    const testLog = await AuditLog.create({
      documentId: new mongoose.Types.ObjectId(), // Fixed: use 'new' keyword
      collectionName: 'test-collection',
      action: 'CREATE',
      documentSnapshot: { test: 'data' },
      source: 'test',
      timestamp: new Date()
    });
    
    console.log('✅ Test audit log created:', testLog._id);
    
    // Clean up test log
    await AuditLog.deleteOne({ _id: testLog._id });
    console.log('🧹 Test log cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Test audit logging failed:', error);
    return false;
  }
}

module.exports = { 
  setupAuditTracking,
  testAuditLogging 
};
