const { MONTH_NAMES, formatTime } = require('#shared/email/email.instance');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const buildRow = (label, value, emphasized = false) => ({
  label,
  value: hasValue(value) ? String(value) : '',
  emphasized,
});

const buildSection = (title, rows) => ({
  title,
  rows: rows.filter((row) => row && row.value !== ''),
});

const compactSections = (sections) => sections.filter((section) => section && section.rows.length > 0);

const capitalizeFirst = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

const TIME_PATTERN = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(a|p)?\.?(?:m)?\.?$/i;

const formatTimeLabel = (timeText) => {
  if (!hasValue(timeText)) return '';

  const match = String(timeText).trim().match(TIME_PATTERN);
  if (!match) return String(timeText);

  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  const meridiemLetter = match[3] ? match[3].toLowerCase() : null;

  const isPastNoon = meridiemLetter ? meridiemLetter === 'p' : hours >= 12;
  const twelveHourValue = hours % 12 === 0 ? 12 : hours % 12;

  return `${twelveHourValue}:${minutes} ${isPastNoon ? 'pm' : 'am'}`;
};

const formatMonthYear = (month, year) => `${MONTH_NAMES[month] ?? month} ${year}`;

const formatLocationText = (location) =>
  Array.isArray(location) ? location.filter(Boolean).join(', ') : location || '';

const formatShiftLabel = (shift) => {
  if (shift.shiftName) return shift.shiftName;
  if (shift.shiftStart) {
    return `${formatTime(shift.shiftStart)}${shift.shiftEnd ? ` – ${formatTime(shift.shiftEnd)}` : ''}`;
  }
  return '';
};

const formatOperatorWithShift = (operator) => {
  const shiftLabel = formatShiftLabel(operator);
  return shiftLabel ? `${operator.operatorName} (${shiftLabel})` : operator.operatorName;
};

const buildOperatorRows = (operators, label, emphasized = true) => {
  const namedOperators = operators.filter((operator) => operator.operatorName);
  return namedOperators.map((operator, operatorIndex) =>
    buildRow(
      namedOperators.length > 1 ? `${label} ${operatorIndex + 1}` : label,
      formatOperatorWithShift(operator),
      emphasized
    )
  );
};

const extractOperatorNames = (names) => [...new Set(names.filter(Boolean))];

const buildRateSection = (title, rentRate) => {
  if (!rentRate) return null;
  return buildSection(title, [
    buildRow('Basis', rentRate.basis ? capitalizeFirst(rentRate.basis) : 'N/A'),
    buildRow('Rate', rentRate.rate ? `${rentRate.rate} ${rentRate.currency || 'QAR'}` : 'N/A', true),
  ]);
};

module.exports = {
  buildRow,
  buildSection,
  compactSections,
  capitalizeFirst,
  formatTimeLabel,
  formatMonthYear,
  formatLocationText,
  formatShiftLabel,
  formatOperatorWithShift,
  buildOperatorRows,
  extractOperatorNames,
  buildRateSection,
};