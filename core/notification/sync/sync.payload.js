const { createSyncToken } = require('./sync.token');

const buildSyncPayload = (uniqueCode) => {
  const syncUrl = process.env.NOTIFICATION_SYNC_BASE_URL;
  if (!syncUrl || !process.env.NOTIFICATION_SYNC_SECRET) return {}; 
  return { syncUrl, syncToken: createSyncToken(uniqueCode) };
};

module.exports = { buildSyncPayload };