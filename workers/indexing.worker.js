const mongoose = require('mongoose');
const logger = require('#shared/logger/logger');

const INDEX_FIX_REGISTRY = [
  {
    collection: 'attendances',
    keepIndexes: [
      '_id_',
      'pin_1_dateOnly_1',
      'punchDateTime_-1',
      'dateOnly_1',
      'monthYear_1',
      'year_1',
      'weekNumber_1_year_1',
    ],
  },
  {
    collection: 'sessions',
    keepIndexes: ['_id_', 'userId_1_isActive_1', 'expiresAt_1'],
  },
  {
    collection: 'otps',
    keepIndexes: [
      '_id_',
      'email_1_verified_1',
      'expiresAt_1',
      'verified_1_createdAt_1',
    ],
  },
  {
    collection: 'stocks',
    keepIndexes: [
      '_id_',
      'product_1',
      'status_1',
      'category_1_subCategory_1',
      'equipmentId_1',
      'movements.date_-1',
      'movements.equipmentId_1',
      'movements.mechanicId_1',
      'movements.type_1',
    ],
  },
  {
    collection: 'purchaseOrder',
    keepIndexes: ['_id_', 'purchaseorderRef_1', 'createdAt_-1'],
  },
  {
    collection: 'backcharges',
    keepIndexes: [
      '_id_',
      'equipmentType_1',
      'supplierName_1',
      'status_1',
      'createdAt_-1',
      'date_1',
      'costSummary.totalCost_1',
    ],
  },
  {
    collection: 'explorers',
    keepIndexes: ['_id_', 'isActive_1'],
  },
  {
    collection: 'equipmentImages',
    keepIndexes: ['_id_', 'equipmentNo_1'],
  },
];

const fixDuplicateIndexes = async () => {
  logger.info('[indexing.worker] fixing duplicate indexes...');

  const [notificationCollection] = await mongoose.connection.db
    .listCollections({ name: 'notifications' }, { nameOnly: true })
    .toArray();
  if (notificationCollection) {
    const notifications = mongoose.connection.db.collection('notifications');
    const indexes = await notifications.indexes();

    for (const index of indexes) {
      const fields = Object.keys(index.key);
      if (
        fields.includes('recipients') &&
        (fields.includes('mentions') || fields.includes('readBy.uniqueCode'))
      ) {
        await notifications.dropIndex(index.name);
        logger.info(`[indexing.worker] dropped invalid notifications index: ${index.name}`);
      }
    }
  }

  for (const { collection, keepIndexes } of INDEX_FIX_REGISTRY) {
    try {
      const col = mongoose.connection.db.collection(collection);
      const indexes = await col.indexes();

      for (const index of indexes) {
        if (!keepIndexes.includes(index.name)) {
          try {
            await col.dropIndex(index.name);
            logger.info(`[indexing.worker] dropped: ${collection} → ${index.name}`);
          } catch (err) {
            logger.error(
              `[indexing.worker] failed to drop ${collection} → ${index.name}:`,
              err.message
            ); 
          }
        }
      }
    } catch (err) {
      logger.error(
        `[indexing.worker] error processing collection ${collection}:`,
        err.message
      );
    }
  }

  logger.info('[indexing.worker] all duplicate indexes resolved');
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { fixDuplicateIndexes };
