const mongoose = require('mongoose');

class IndexManager {
  
  // Check all indexes on a collection
  static async checkIndexes(model) {
    try {
      const indexes = await model.collection.getIndexes();
      return indexes;
    } catch (error) {
      console.error('Error checking indexes:', error);
      return null;
    }
  }

  // Drop a specific problematic index
  static async dropIndex(model, indexName) {
    try {
      await model.collection.dropIndex(indexName);
      return true;
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        return true;
      }
      console.error(`Error dropping index ${indexName}:`, error.message);
      return false;
    }
  }

  // Clean up problematic indexes
  static async cleanupProblematicIndexes(model) {
    try {
      const indexes = await this.checkIndexes(model);
      
      if (indexes && indexes.re_1) {
        console.log('Found problematic re_1 index, dropping it...');
        await this.dropIndex(model, 're_1');
      }
      
      // Check for any other suspicious indexes that might cause issues
      const problematicIndexes = Object.keys(indexes || {}).filter(indexName => 
        !['_id_', 'equipmentNo_1'].includes(indexName)
      );
      
      if (problematicIndexes.length > 0) {
        console.log('Found additional potentially problematic indexes:', problematicIndexes);
        for (const indexName of problematicIndexes) {
          if (indexName !== 'equipmentNo_1') { // Keep the equipmentNo unique index
            await this.dropIndex(model, indexName);
          }
        }
      }
      
      console.log('Index cleanup completed');
      return true;
    } catch (error) {
      console.error('Error during index cleanup:', error);
      return false;
    }
  }

  // Ensure correct indexes exist
  static async ensureCorrectIndexes(model) {
    try {
      // Ensure equipmentNo has unique index
      await model.collection.createIndex({ equipmentNo: 1 }, { unique: true });
      console.log('Ensured equipmentNo unique index exists');
      return true;
    } catch (error) {
      if (error.code === 85) { // Index already exists
        console.log('equipmentNo index already exists');
        return true;
      }
      console.error('Error creating indexes:', error);
      return false;
    }
  }
}

module.exports = IndexManager;