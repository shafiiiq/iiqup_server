const { MONTHS } = require('../constants/mechanic.constants');

// ─────────────────────────────────────────────────────────────────────────────
// Date Formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a "Month YYYY" string for a given date.
 * @param {Date} date
 * @returns {string}
 */
const getMonthYearString = (date) => `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

/**
 * Returns a DD-MM-YYYY formatted string for a given date.
 * @param {Date} date
 * @returns {string}
 */
const getFormattedDateString = (date) =>
  `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

// ─────────────────────────────────────────────────────────────────────────────
// Overtime Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a "Month YYYY" string is older than the cutoff month.
 * @param {string} monthYear       e.g. "January 2024"
 * @param {string} cutoffMonthYear e.g. "March 2024"
 * @returns {boolean}
 */
const isOlderThanCutoff = (monthYear, cutoffMonthYear) => {
  const [monthName,   yearStr]       = monthYear.split(' ');
  const [cutoffMonth, cutoffYearStr] = cutoffMonthYear.split(' ');

  const year       = parseInt(yearStr);
  const cutoffYear = parseInt(cutoffYearStr);

  if (year < cutoffYear) return true;
  if (year > cutoffYear) return false;

  return MONTHS.indexOf(monthName) < MONTHS.indexOf(cutoffMonth);
};

/**
 * Resolves the cutoff "Month YYYY" string, defined as 2 months ago.
 * @returns {string}
 */
const getCutoffMonthYear = () => {
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  return getMonthYearString(twoMonthsAgo);
};

// ─────────────────────────────────────────────────────────────────────────────
// Error Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a Mongoose ValidationError into a single readable message string.
 * @param {Error} error
 * @returns {string}
 */
const formatValidationError = (error) =>
  Object.values(error.errors).map(e => e.message).join(', ');

// ─────────────────────────────────────────────────────────────────────────────
// Response Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the standard attendance response payload.
 * @param {object}   mechanic
 * @param {object[]} records
 * @param {object}   extra   Additional fields to merge into data.
 * @returns {object}
 */
const buildAttendanceResponse = (mechanic, records, extra = {}) => ({
  status: 200,
  data: {
    mechanic: { name: mechanic.name, zktecoPin: mechanic.zktecoPin },
    records,
    count: records.length,
    ...extra
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getMonthYearString,
  getFormattedDateString,
  isOlderThanCutoff,
  getCutoffMonthYear,
  formatValidationError,
  buildAttendanceResponse
};