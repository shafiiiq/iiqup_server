// ─────────────────────────────────────────────────────────────────────────────
// Email Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.zip':  'application/zip',
};

/**
 * Load a local image and return a base64 data URI, or '' on failure.
 */
const loadImageAsBase64 = (filename) => {
  try {
    const imgPath = path.join(__dirname, '../assets/images', filename);
    const buffer  = fs.readFileSync(imgPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    console.warn(`[Gmail] Image not found: ${filename}`);
    return '';
  }
};

/**
 * Resolve MIME type from a filename extension.
 */
const getMimeType = (filename) =>
  MIME_TYPES[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';

/**
 * Format time to AM/PM
 */
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

module.exports = { MIME_TYPES, loadImageAsBase64, getMimeType, formatTime };