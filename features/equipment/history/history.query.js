const resolveMonthStart = (baseDate, monthsBack) =>
  new Date(baseDate.getFullYear(), baseDate.getMonth() - monthsBack + 1, 1);

const toDateOnlyString = (date) => date.toISOString().split('T')[0];

const buildDateFilterQuery = ({ dateFilterMode, lastMonthsCount, customStartDate, customEndDate }) => {
  const now = new Date();

  switch (dateFilterMode) {
    case 'lastXmonths': {
      const start = resolveMonthStart(now, lastMonthsCount || 6);
      return { date: { $gte: toDateOnlyString(start) } };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { date: { $gte: toDateOnlyString(start) } };
    }
    case 'custom': {
      if (!customStartDate || !customEndDate) return {};
      return { date: { $gte: customStartDate, $lte: customEndDate } };
    }
    default:
      return {};
  }
};

module.exports = { buildDateFilterQuery };