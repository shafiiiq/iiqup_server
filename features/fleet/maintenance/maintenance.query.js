const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDays = (baseDate, dayOffset) => {
  const shifted = new Date(baseDate);
  shifted.setDate(shifted.getDate() + dayOffset);
  return shifted;
};

const buildDateFilterQuery = (
  { dateFilterMode, lastMonthsCount, customStartDate, customEndDate },
  now = new Date()
) => {
  switch (dateFilterMode) {
    case 'today':
      return { date: formatLocalDate(now) };
    case 'yesterday':
      return { date: formatLocalDate(shiftDays(now, -1)) };
    case 'last7days':
      return { date: { $gte: formatLocalDate(shiftDays(now, -7)) } };
    case 'last30days':
      return { date: { $gte: formatLocalDate(shiftDays(now, -30)) } };
    case 'last365days':
      return { date: { $gte: formatLocalDate(shiftDays(now, -365)) } };
    case 'lastXmonths': {
      const start = new Date(now.getFullYear(), now.getMonth() - (lastMonthsCount || 6) + 1, 1);
      return { date: { $gte: formatLocalDate(start) } };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { date: { $gte: formatLocalDate(start) } };
    }
    case 'custom':
      if (!customStartDate || !customEndDate) return {};
      return { date: { $gte: customStartDate, $lte: customEndDate } };
    default:
      return {};
  }
};

const buildMaintenanceFilterQuery = ({ regNos, serviceType, ...dateFilter }) => ({
  ...(regNos?.length ? { regNo: { $in: regNos.map(String) } } : {}),
  ...(serviceType ? { serviceType } : {}),
  ...buildDateFilterQuery(dateFilter),
});

module.exports = { buildMaintenanceFilterQuery };