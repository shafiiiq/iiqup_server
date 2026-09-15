const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfCurrentWeek = () => {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return sunday;
};

const buildDailyBuckets = () => {
  const sunday = startOfCurrentWeek();
  return DAY_LABELS.map((label, index) => {
    const start = new Date(sunday);
    start.setDate(sunday.getDate() + index);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { label, start, end };
  });
};

const buildWeeklyBuckets = () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const buckets = [];
  const cursor = new Date(monthStart);
  let weekNumber = 1;

  while (cursor <= monthEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    if (end > monthEnd) end.setTime(monthEnd.getTime());
    end.setHours(23, 59, 59, 999);

    buckets.push({ label: `Week ${weekNumber}`, start, end });
    cursor.setDate(cursor.getDate() + 7);
    weekNumber += 1;
  }

  return buckets;
};

const buildMonthlyBuckets = () => {
  const year = new Date().getFullYear();
  return MONTH_LABELS.map((label, index) => {
    const start = new Date(year, index, 1);
    const end = new Date(year, index + 1, 0, 23, 59, 59, 999);
    return { label, start, end };
  });
};

const buildYearlyBuckets = (yearsBack = 4) => {
  const currentYear = new Date().getFullYear();
  const buckets = [];
  for (let offset = yearsBack; offset >= 0; offset -= 1) {
    const year = currentYear - offset;
    buckets.push({
      label: String(year),
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    });
  }
  return buckets;
};

const GRANULARITY_BUILDERS = {
  daily: buildDailyBuckets,
  weekly: buildWeeklyBuckets,
  monthly: buildMonthlyBuckets,
  yearly: buildYearlyBuckets,
};

const isValidGranularity = (granularity) => Boolean(GRANULARITY_BUILDERS[granularity]);

const buildBuckets = (granularity) => {
  const builder = GRANULARITY_BUILDERS[granularity];
  if (!builder) throw new Error(`Unknown granularity: ${granularity}`);
  return builder();
};

module.exports = { buildBuckets, isValidGranularity };
