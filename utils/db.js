const mongoose = require('mongoose');
require('dotenv').config();

let indexFixed = false; // Flag to ensure we only run this once

module.exports = mongoose.connect(process.env.MONGO_URI)
.then(async (result) => {
  console.log("mongoDB connected"); 
  
  // One-time index fix
  if (!indexFixed) {
    try {
      // Simply drop all indexes except _id and recreate only the ones we need
      const collection = mongoose.connection.db.collection('equipmenthandovers');
      
      // Get current indexes
      const indexes = await collection.indexes();
      console.log('Current indexes:', indexes.map(idx => idx.name));
      
      // Drop problematic indexes (keep _id index)
      for (const index of indexes) {
        if (index.name !== '_id_' && index.name !== 'equipmentNo_1') {
          try {
            await collection.dropIndex(index.name);
            console.log(`Dropped index: ${index.name}`);
          } catch (err) {
            console.log(`Could not drop ${index.name}:`, err.message);
          }
        }
      }
      
      indexFixed = true;
      console.log("Database indexes fixed");
    } catch (error) {
      console.error('Error fixing indexes:', error);
    }
  }
  
  return result;
})
.catch((err) => {
  console.log("DB connection failed");
  throw err;
});