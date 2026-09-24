// utils/db.js
const mongoose = require('mongoose');
const { fixDuplicateIndexes } = require('../workers/indexing.worker');
const logger = require('#shared/logger/logger');
require('dotenv').config();

module.exports = mongoose
  .connect(process.env.LOCAL_MONGO_URI)
  .then(async (result) => { 
    logger.info('[ansarigroup.db] connected');
    await fixDuplicateIndexes();
    return result;
  })
  .catch((err) => {
    logger.error('[ansarigroup.db] connection failed:', err);
    throw err;
  });
