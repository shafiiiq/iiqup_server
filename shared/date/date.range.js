const startOfDay = (date) => {
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (date) => {
  date.setHours(23, 59, 59, 999);
  return date;
};

const parseDMY = (value) => {
  const [day, month, year] = value.split('-');
  return new Date(year, month - 1, day);
};

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const RANGE_RESOLVERS = {
  daily: () => ({ startDateTime: startOfDay(new Date()), endDateTime: endOfDay(new Date()) }),

  yesterday: () => ({
    startDateTime: startOfDay(daysAgo(1)),
    endDateTime: endOfDay(daysAgo(1)),
  }),

  weekly: () => ({ startDateTime: startOfDay(daysAgo(7)), endDateTime: endOfDay(new Date()) }),

  monthly: () => ({ startDateTime: startOfDay(daysAgo(30)), endDateTime: endOfDay(new Date()) }),

  yearly: () => ({ startDateTime: startOfDay(daysAgo(365)), endDateTime: endOfDay(new Date()) }),

  months: (_start, _end, months) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (parseInt(months, 10) || 1));
    return { startDateTime: startOfDay(date), endDateTime: endOfDay(new Date()) };
  },

  single: (startDate) => {
    if (!startDate) throw new Error('Date is required for single date filter');
    const date = parseDMY(startDate);
    return { startDateTime: startOfDay(new Date(date)), endDateTime: endOfDay(new Date(date)) };
  },

  custom: (startDate, endDate) => {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required for custom range');
    }
    return {
      startDateTime: startOfDay(parseDMY(startDate)),
      endDateTime: endOfDay(parseDMY(endDate)),
    };
  },
};

const DEFAULT_RANGE = () => ({
  startDateTime: startOfDay(daysAgo(30)),
  endDateTime: endOfDay(new Date()),
});

const resolveDateRange = (filterType, startDate = null, endDate = null, months = null) => {
  const resolver = RANGE_RESOLVERS[filterType] || DEFAULT_RANGE;
  return resolver(startDate, endDate, months);
};

const buildDateRangeQuery = (startDateTime, endDateTime) => ({
  date: { $gte: startDateTime, $lte: endDateTime },
});

module.exports = {
  resolveDateRange,
  buildDateRangeQuery,
};
