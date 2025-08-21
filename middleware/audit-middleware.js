// 1. FIXED AUDIT MIDDLEWARE (middleware/audit-middleware.js)
const AuditLog = require('../models/audit-log.model');
const mongoose = require('mongoose');

/**
 * Enhanced audit middleware with proper error handling and ObjectId fix
 */
function createAuditMiddleware(collectionName) {
  return function(schema) {    
    // Helper function to safely create audit log
    async function createAuditLog(data) {
      try {
        const auditLog = new AuditLog({
          ...data,
          collectionName: collectionName,
          timestamp: new Date()
        });
        
        const saved = await auditLog.save();
        return saved;
      } catch (error) {
        console.error(`❌ Failed to create audit log for ${collectionName}:`, error.message);
        console.error('Data:', JSON.stringify(data, null, 2));
      }
    }

    // Helper to detect changes between old and new documents
    function detectChanges(oldDoc, newDoc) {
      const changes = [];
      if (!oldDoc || !newDoc) return changes;

      const oldObj = oldDoc.toObject ? oldDoc.toObject() : oldDoc;
      const newObj = newDoc.toObject ? newDoc.toObject() : newDoc;

      for (const key in newObj) {
        if (key === '_id' || key === '__v' || key === 'updatedAt') continue;
        
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          changes.push({
            field: key,
            oldValue: oldObj[key],
            newValue: newObj[key]
          });
        }
      }
      return changes;
    }

    // Track CREATE operations
    schema.post('save', async function(doc) {
      if (this.isNew) {
        await createAuditLog({
          documentId: doc._id,
          action: 'CREATE',
          documentSnapshot: doc.toObject(),
          source: 'database'
        });
      }
    });

    // Track UPDATE operations - findOneAndUpdate with proper change detection
    schema.pre('findOneAndUpdate', async function() {
      this._originalDoc = await this.model.findOne(this.getQuery());
    });

    schema.post('findOneAndUpdate', async function(doc) {
      if (doc && this._originalDoc) {
        const changes = detectChanges(this._originalDoc, doc);
        
        await createAuditLog({
          documentId: doc._id,
          action: 'UPDATE',
          documentSnapshot: doc.toObject ? doc.toObject() : doc,
          changes: changes,
          source: 'database'
        });
      }
    });

    // Track UPDATE operations - updateOne/updateMany
    schema.post('updateOne', async function(result) {
      if (result.modifiedCount > 0) {
        const query = this.getQuery();
        const docId = query._id;
        
        if (docId) {
          await createAuditLog({
            documentId: docId,
            action: 'UPDATE',
            documentSnapshot: { query: query, result: result },
            changes: [{ field: 'updated', oldValue: 'unknown', newValue: 'modified via updateOne' }],
            source: 'database'
          });
        }
      }
    });

    // Track DELETE operations - findOneAndDelete
    schema.post('findOneAndDelete', async function(doc) {
      if (doc) {
        await createAuditLog({
          documentId: doc._id,
          action: 'DELETE',
          documentSnapshot: doc.toObject ? doc.toObject() : doc,
          source: 'database'
        });
      }
    });

    // Track DELETE operations - deleteOne
    schema.post('deleteOne', async function(result) {
      if (result.deletedCount > 0) {
        const query = this.getQuery();
        const docId = query._id;
        
        if (docId) {
          await createAuditLog({
            documentId: docId,
            action: 'DELETE',
            documentSnapshot: { query: query, result: result },
            source: 'database'
          });
        }
      }
    });
  };
}

/**
 * Context middleware
 */
function auditContextMiddleware(req, res, next) {
  req.auditContext = {
    source: 'api',
    endpoint: req.originalUrl,
    method: req.method,
    timestamp: new Date()
  };
  next();
}

module.exports = {
  createAuditMiddleware,
  auditContextMiddleware
};