const { resolveDateRange, buildDateRangeQuery } = require('#shared/date/date.range');

const buildActivityFilterQuery = ({
  filterType,
  startDate,
  endDate,
  months,
  specificDate,
  specificTime,
  startTime,
  endTime,
}) => {
  const query = {};

  if (filterType && filterType !== 'all') {
    const { startDateTime, endDateTime } = resolveDateRange(
      filterType,
      startDate || specificDate,
      endDate,
      months
    );
    Object.assign(query, buildDateRangeQuery(startDateTime, endDateTime));
  }

  if (specificTime) {
    query.time = specificTime;
  } else if (startTime && endTime) {
    query.time = { $gte: startTime, $lte: endTime };
  }

  return query;
};

module.exports = { buildActivityFilterQuery };