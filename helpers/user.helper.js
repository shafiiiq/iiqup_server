// helpers/user.helper.js
const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// Date & Time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string to a human-readable date.
 * @param {string} isoString
 * @returns {string}
 */
const formatDate = (isoString) => {
  if (!isoString) return 'Invalid Date';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Converts an ISO time string to 12-hour AM/PM format.
 * @param {string} isoString
 * @returns {string}
 */
const convertToAMPM = (isoString) => {
  if (!isoString) return 'Invalid Time';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the notification channel ID based on priority.
 * @param {string} priority
 * @returns {string}
 */
const getChannelId = (priority) => {
  switch (priority) {
    case 'high':
    case 'urgent': return 'urgent';
    case 'low':    return 'silent';
    default:       return 'default';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// File
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the file type from a MIME type string.
 * @param {string} mimeType
 * @returns {string}
 */
const getFileType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'unknown';
};

/**
 * Deletes a list of temporary uploaded files from disk.
 * @param {Array} files
 */
const cleanupFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (error) {
      console.error(`[UserHelper] cleanupFiles: failed to delete ${file.filename}:`, error.message);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { formatDate, convertToAMPM, getChannelId, getFileType, cleanupFiles };