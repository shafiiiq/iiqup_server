const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const logger = require('#shared/logger/logger');
const { ROLE_PREFIX_MAP } = require('./staff.constant');

const generateUniqueCode = (role) => {
  const prefix = ROLE_PREFIX_MAP[role] || 'USR';
  return `${prefix}-${uuidv4().substring(0, 6)}`;
};

const formatDate = (isoString) => {
  if (!isoString) return 'Invalid Date';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const convertToAmPm = (isoString) => {
  if (!isoString) return 'Invalid Time';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getChannelId = (priority) => {
  switch (priority) {
    case 'high':
    case 'urgent':
      return 'urgent';
    case 'low':
      return 'silent';
    default:
      return 'default';
  }
};

const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'unknown';
};

const cleanupFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  files.forEach((file) => {
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (error) {
      logger.error(
        `[UserHelper] cleanupFiles: failed to delete ${file.filename}:`,
        error.message
      );
    }
  });
};

module.exports = {
  generateUniqueCode,
  formatDate,
  convertToAmPm,
  getChannelId,
  getFileType,
  cleanupFiles,
};
