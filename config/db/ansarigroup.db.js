// utils/db.js
const mongoose = require('mongoose');
const { fixDuplicateIndexes } = require('./workers/indexing.worker');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Database Connection
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose
  .connect(process.env.MONGO_URI)
  .then(async (result) => {
    console.log('[DB] connected');
    await fixDuplicateIndexes();
    return result;
  })
  .catch((err) => {
    console.error('[DB] connection failed:', err);
    throw err;
  });
