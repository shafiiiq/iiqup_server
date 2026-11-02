const uploadService = require('#core/upload/upload.service');

const findCompletedComplaintSessions = async ({ sessionIds, uploadedBy }) => {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return [];
  return uploadService.getCompletedSessions({ sessionIds, uploadedBy, feature: 'complaint' });
};

module.exports = { findCompletedComplaintSessions };