// ─── Upload config ─────────────────────────────────────────────────────────

const MIN_PART_SIZE = 8 * 1024 * 1024; // 8MB — safely above S3's 5MB per-part minimum
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB hard ceiling
const PART_URL_BATCH_SIZE = 25; // presigned part URLs handed out per request
const SESSION_STALE_HOURS = 24; // sessions idle longer than this are considered abandoned

module.exports = {
  MIN_PART_SIZE,
  MAX_FILE_SIZE,
  PART_URL_BATCH_SIZE,
  SESSION_STALE_HOURS,
};