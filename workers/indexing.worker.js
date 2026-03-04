// workers/db.index.cron.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Index Fix Registry
// Each entry defines which indexes to KEEP for a given collection.
// All other non-_id indexes will be dropped to eliminate duplicates
// caused by having both `unique: true` on the field AND schema.index().
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_FIX_REGISTRY = [
  {
    collection:  'attendances',
    keepIndexes: ['_id_', 'pin_1_dateOnly_1', 'punchDateTime_-1', 'dateOnly_1', 'monthYear_1', 'year_1', 'weekNumber_1_year_1'],
  },
  {
    collection:  'sessions',
    keepIndexes: ['_id_', 'userId_1_isActive_1', 'expiresAt_1'],
  },
  {
    collection:  'otps',
    keepIndexes: ['_id_', 'email_1_verified_1', 'expiresAt_1', 'verified_1_createdAt_1'],
  },
  {
    collection:  'stocks',
    keepIndexes: ['_id_', 'product_1', 'status_1', 'category_1_subCategory_1', 'equipmentId_1', 'movements.date_-1', 'movements.equipmentId_1', 'movements.mechanicId_1', 'movements.type_1'],
  },
  {
    collection:  'lpos',
    keepIndexes: ['_id_', 'createdAt_-1'],
  },
  {
    collection:  'backcharges',
    keepIndexes: ['_id_', 'equipmentType_1', 'supplierName_1', 'status_1', 'createdAt_-1', 'date_1', 'costSummary.totalCost_1'],
  },
  {
    collection:  'explorers',
    keepIndexes: ['_id_', 'isActive_1'],
  },
  {
    collection:  'equipmenthandovers',
    keepIndexes: ['_id_', 'equipmentNo_1'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drops duplicate indexes across all registered collections.
 * Safe to run on every startup — skips indexes that don't exist.
 */
const fixDuplicateIndexes = async () => {
  console.log('[DBIndexCron] fixing duplicate indexes...');

  for (const { collection, keepIndexes } of INDEX_FIX_REGISTRY) {
    try {
      const col     = mongoose.connection.db.collection(collection);
      const indexes = await col.indexes();

      for (const index of indexes) {
        if (!keepIndexes.includes(index.name)) {
          try {
            await col.dropIndex(index.name);
            console.log(`[DBIndexCron] dropped: ${collection} → ${index.name}`);
          } catch (err) {
            console.error(`[DBIndexCron] failed to drop ${collection} → ${index.name}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error(`[DBIndexCron] error processing collection ${collection}:`, err.message);
    }
  }

  console.log('[DBIndexCron] all duplicate indexes resolved');
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { fixDuplicateIndexes };