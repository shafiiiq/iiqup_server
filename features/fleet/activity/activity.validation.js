const { ACTIVITY_TABS } = require('./activity.constant');

const validateActivityFeedQuery = ({
  tab,
  filterType,
  startDate,
  endDate,
  months,
  specificDate,
  startTime,
  endTime,
}) => {
  if (tab && !Object.values(ACTIVITY_TABS).includes(tab)) return 'Invalid tab';
  if (filterType === 'custom' && (!startDate || !endDate)) {
    return 'startDate and endDate are required for custom range';
  }
  if (filterType === 'single' && !specificDate && !startDate) {
    return 'Date is required for single date filter';
  }
  if (filterType === 'months' && !months) return 'months is required for months filter type';
  if (startTime && endTime && startTime > endTime) return 'startTime must be before endTime';
  return null;
};

module.exports = { validateActivityFeedQuery };