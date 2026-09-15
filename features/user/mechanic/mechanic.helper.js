const formatValidationError = (error) =>
  Object.values(error.errors)
    .map((e) => e.message)
    .join(', ');

const buildAttendanceFilter = (zktecoPin, query) => {
  const pin = parseInt(zktecoPin);
  const { date, startDate, endDate, year, month, week, months, years, weeks } = query;

  if (weeks) {
    return {
      $or: weeks.split(',').map((entry) => {
        const [weekYear, weekNumber] = entry.trim().split('-');
        return { pin, year: parseInt(weekYear), weekNumber: parseInt(weekNumber) };
      }),
    };
  }

  const filter = { pin };

  if (date) filter.dateOnly = date;
  if (startDate && endDate) filter.dateOnly = { $gte: startDate, $lte: endDate };
  if (months) filter.monthYear = { $in: months.split(',').map((m) => m.trim()) };
  if (years) filter.year = { $in: years.split(',').map((y) => parseInt(y.trim())) };
  if (year && month) filter.monthYear = `${year}-${String(month).padStart(2, '0')}`;
  if (year && week) {
    filter.year = parseInt(year);
    filter.weekNumber = parseInt(week);
  }
  if (year && !month && !week && !years) filter.year = parseInt(year);

  return filter;
};

module.exports = {
  formatValidationError,
  buildAttendanceFilter,
};