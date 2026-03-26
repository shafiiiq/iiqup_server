// ─── Dashboard Analyser ───────────────────────────────────────────────────────
// Reads from REGISTRY. Zero hardcoded model names.
// All analysis is keyed by registry entry — new models auto-appear everywhere.

const { REGISTRY, getSchemaMap } = require('../registry/model.registry');
const equipmentModel = require('../models/equipment.model.js');

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

const cache = {
  _store: {},
  set: (key, value, ttl = 300000) => {
    cache._store[key] = { value, expires: Date.now() + ttl };
  },
  get: (key) => {
    const item = cache._store[key];
    if (!item) return null;
    if (Date.now() > item.expires) { delete cache._store[key]; return null; }
    return item.value;
  },
  clear: () => { cache._store = {}; },
};

// ─────────────────────────────────────────────────────────────────────────────
// Period definitions
// ─────────────────────────────────────────────────────────────────────────────

const PERIODS = {
  today: () => {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    return { start: s, end: null, ttl: 60_000, label: 'Today' };
  },
  week: () => {
    const s = new Date(); s.setDate(s.getDate() - 7);
    return { start: s, end: null, ttl: 120_000, label: 'Last 7 days' };
  },
  month: () => {
    const s = new Date(); s.setMonth(s.getMonth() - 1);
    return { start: s, end: null, ttl: 300_000, label: 'Last 30 days' };
  },
  quarter: () => {
    const s = new Date(); s.setMonth(s.getMonth() - 3);
    return { start: s, end: null, ttl: 600_000, label: 'Last 90 days' };
  },
  year: () => {
    const s = new Date(); s.setFullYear(s.getFullYear() - 1);
    return { start: s, end: null, ttl: 600_000, label: 'Last 365 days' };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Low-level helpers
// ─────────────────────────────────────────────────────────────────────────────

const dateRangeQuery = (start, end = null) => ({
  $or: [
    { createdAt: end ? { $gte: start, $lte: end } : { $gte: start } },
    { updatedAt: end ? { $gte: start, $lte: end } : { $gte: start } },
  ],
});

const sumValues   = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

// Runs countDocuments for every registered model, returns { [key]: count }
const countsForRange = async (start, end = null) => {
  const query   = dateRangeQuery(start, end);
  const entries = await Promise.all(
    REGISTRY.map(async ({ model, key }) => [key, await model.countDocuments(query)])
  );
  return Object.fromEntries(entries);
};

// Returns the N most-recent docs per model since start, keyed by registry key
const docsForRange = async (start, limit = 50) => {
  const query = dateRangeQuery(start);
  const entries = await Promise.all(
    REGISTRY.map(async ({ model, key, label }) => {
      const docs = await model.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      return [key, docs.map(d => ({ ...d, _collection: key, _label: label }))];
    })
  );
  return Object.fromEntries(entries);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Statistics  — totals, growth rate, most-active collection
// ─────────────────────────────────────────────────────────────────────────────

const fetchStatistics = async (periodKey = 'month') => {
  const cacheKey = `stats:${periodKey}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const { start, end, ttl, label } = PERIODS[periodKey]();

  // Current period vs previous period (same duration) for growth
  const duration    = Date.now() - start.getTime();
  const prevStart   = new Date(start.getTime() - duration);
  const prevEnd     = new Date(start);

  const [current, previous] = await Promise.all([
    countsForRange(start, end),
    countsForRange(prevStart, prevEnd),
  ]);

  const total     = sumValues(current);
  const prevTotal = sumValues(previous);
  const growth    = prevTotal === 0 ? null : (((total - prevTotal) / prevTotal) * 100).toFixed(1);

  // Per-collection growth
  const breakdown = Object.fromEntries(
    REGISTRY.map(({ key, label: colLabel }) => {
      const curr = current[key]  || 0;
      const prev = previous[key] || 0;
      const g    = prev === 0 ? null : (((curr - prev) / prev) * 100).toFixed(1);
      return [key, { label: colLabel, current: curr, previous: prev, growthPct: g }];
    })
  );

  // Most active collection
  const mostActive = Object.entries(breakdown)
    .sort((a, b) => b[1].current - a[1].current)[0];

  const result = {
    status: 200,
    data: {
      type:       'statistics',
      period:     { key: periodKey, label },
      total,
      growth:     { pct: growth, direction: growth > 0 ? 'up' : growth < 0 ? 'down' : 'flat' },
      mostActive: { key: mostActive[0], ...mostActive[1] },
      breakdown,
      schema:     getSchemaMap(), // frontend gets field info for free
    }
  };

  cache.set(cacheKey, result, ttl);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Graphs — time-series data (bar, line, pie)
//    Returns both total and per-collection buckets so frontend
//    can render pie (collection share) or line (trend) from the same payload
// ─────────────────────────────────────────────────────────────────────────────

const fetchGraphData = async (granularity = 'daily', nPoints = 7) => {
  const cacheKey = `graph:${granularity}:${nPoints}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const now    = new Date();
  const points = [];

  for (let i = nPoints - 1; i >= 0; i--) {
    let start, end, label;

    if (granularity === 'daily') {
      start = new Date(now); start.setDate(now.getDate() - i); start.setHours(0, 0, 0, 0);
      end   = new Date(start); end.setHours(23, 59, 59, 999);
      label = start.toISOString().split('T')[0];
    } else if (granularity === 'weekly') {
      start = new Date(now); start.setDate(now.getDate() - i * 7); start.setHours(0, 0, 0, 0);
      end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      label = `W${start.toISOString().split('T')[0]}`;
    } else if (granularity === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      label = start.toLocaleString('default', { month: 'short', year: 'numeric' });
    } else if (granularity === 'yearly') {
      start = new Date(now.getFullYear() - i, 0, 1);
      end   = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999);
      label = String(start.getFullYear());
    }

    const counts = await countsForRange(start, end);
    points.push({ label, total: sumValues(counts), collections: counts });
  }

  // Pie slice data (share of total across all points)
  const totalByCollection = Object.fromEntries(
    REGISTRY.map(({ key, label: colLabel }) => [
      key,
      { label: colLabel, count: points.reduce((s, p) => s + (p.collections[key] || 0), 0) }
    ])
  );

  const ttlMap = { daily: 60_000, weekly: 120_000, monthly: 300_000, yearly: 600_000 };

  const result = {
    status: 200,
    data: {
      type:        'graphs',
      granularity,
      nPoints,
      series:      points,          // → line/bar chart
      pieSlices:   totalByCollection, // → pie chart
      collections: REGISTRY.map(({ key, label: colLabel }) => ({ key, label: colLabel })),
    }
  };

  cache.set(cacheKey, result, ttlMap[granularity] || 300_000);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Latest — last 1-2 days, most recent docs per collection
// ─────────────────────────────────────────────────────────────────────────────

const fetchLatest = async (days = 2, limitPerCollection = 20) => {
  const cacheKey = `latest:${days}:${limitPerCollection}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const start  = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
  const docs   = await docsForRange(start, limitPerCollection);
  const counts = await countsForRange(start);

  const result = {
    status: 200,
    data: {
      type:    'latest',
      since:   start.toISOString(),
      counts,
      total:   sumValues(counts),
      records: docs,
    }
  };

  cache.set(cacheKey, result, 60_000);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Historical — last N days/months/years, counts + docs
// ─────────────────────────────────────────────────────────────────────────────

const fetchHistorical = async (periodKey = 'month', limitPerCollection = 100) => {
  const cacheKey = `historical:${periodKey}:${limitPerCollection}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const { start, end, ttl, label } = PERIODS[periodKey]();

  // records are capped — only for table display
  const [counts, records] = await Promise.all([
    countsForRange(start, end),
    docsForRange(start, limitPerCollection),
  ]);

  const result = {
    status: 200,
    data: {
      type:     'historical',
      period:   { key: periodKey, label },
      counts,            
      total:    sumValues(counts),
      records,           
    }
  };

  cache.set(cacheKey, result, ttl);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Comparison — flexible date-range comparison
//    Compares N custom ranges side-by-side: any two months, years, etc.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array<{label: string, start: string|Date, end: string|Date}>} ranges
 * Example:
 *   [
 *     { label: 'Jan 2025', start: '2025-01-01', end: '2025-01-31' },
 *     { label: 'Feb 2025', start: '2025-02-01', end: '2025-02-28' },
 *   ]
 */
const fetchComparison = async (ranges) => {
  if (!Array.isArray(ranges) || ranges.length < 2) {
    return { status: 400, message: 'Provide at least 2 ranges to compare.' };
  }

  const cacheKey = `compare:${JSON.stringify(ranges)}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const slices = await Promise.all(
    ranges.map(async ({ label, start, end }) => {
      const s      = new Date(start);
      const e      = new Date(end);
      const counts = await countsForRange(s, e);
      return { label, start: s.toISOString(), end: e.toISOString(), counts, total: sumValues(counts) };
    })
  );

  // Delta between each consecutive pair
  const deltas = slices.slice(1).map((slice, i) => {
    const prev   = slices[i];
    const change = slice.total - prev.total;
    const pct    = prev.total === 0 ? null : ((change / prev.total) * 100).toFixed(1);
    return { from: prev.label, to: slice.label, change, pct };
  });

  const result = {
    status: 200,
    data: {
      type:        'comparison',
      slices,
      deltas,
      collections: REGISTRY.map(({ key, label }) => ({ key, label })),
    }
  };

  cache.set(cacheKey, result, 300_000);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Detailed — 1–4 months of paginated records with full field data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} collectionKey  Registry key e.g. 'equipment'
 * @param {number} months         1-4
 * @param {number} page
 * @param {number} pageSize
 */
const fetchDetailed = async (collectionKey, months = 1, page = 1, pageSize = 50) => {
  const entry = REGISTRY.find(r => r.key === collectionKey);
  if (!entry) return { status: 404, message: `Unknown collection: ${collectionKey}` };

  const start  = new Date(); start.setMonth(start.getMonth() - Math.min(months, 4));
  const query  = dateRangeQuery(start);
  const skip   = (page - 1) * pageSize;

  const [total, docs] = await Promise.all([
    entry.model.countDocuments(query),
    entry.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
  ]);

  // Discover fields dynamically from the first doc (or schema)
  const schemaFields = Object.keys(entry.model.schema.paths)
    .filter(p => !['__v'].includes(p));

  return {
    status: 200,
    data: {
      type:       'detailed',
      collection: { key: collectionKey, label: entry.label },
      period:     { months, since: start.toISOString() },
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      fields:     schemaFields,  // frontend builds table columns from this
      records:    docs,
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Business Intelligence extras
// ─────────────────────────────────────────────────────────────────────────────

// Peak-activity analysis: which hour-of-day and day-of-week are busiest
const fetchActivityHeatmap = async (days = 30) => {
  const cacheKey = `heatmap:${days}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const start = new Date(); start.setDate(start.getDate() - days);
  const query = dateRangeQuery(start);

  const hourMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const dayMap  = Array.from({ length: 7  }, (_, d) => ({ day: d, count: 0 }));

  await Promise.all(
    REGISTRY.map(async ({ model }) => {
      const docs = await model.find(query).select('createdAt').lean();
      docs.forEach(d => {
        hourMap[d.createdAt.getHours()].count++;
        dayMap[d.createdAt.getDay()].count++;
      });
    })
  );

  const result = {
    status: 200,
    data: { type: 'heatmap', days, hourly: hourMap, weekly: dayMap }
  };

  cache.set(cacheKey, result, 600_000);
  return result;
};

// Collection health: % filled fields per collection (data quality score)
const fetchDataQuality = async () => {
  const cacheKey = 'data-quality';
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const scores = await Promise.all(
    REGISTRY.map(async ({ model, key, label }) => {
      const sample = await model.find().sort({ createdAt: -1 }).limit(100).lean();
      if (!sample.length) return { key, label, score: null, sampleSize: 0 };

      const fields = Object.keys(model.schema.paths).filter(p => !['__v', '_id', 'createdAt', 'updatedAt'].includes(p));
      let filled = 0, total = 0;

      sample.forEach(doc => {
        fields.forEach(f => {
          total++;
          if (doc[f] != null && doc[f] !== '') filled++;
        });
      });

      return { key, label, score: total ? ((filled / total) * 100).toFixed(1) : null, sampleSize: sample.length };
    })
  );

  const result = {
    status: 200,
    data: { type: 'data-quality', collections: scores }
  };

  cache.set(cacheKey, result, 1_800_000);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Equipment stats dedicated
// ─────────────────────────────────────────────────────────────────────────────

const fetchEquipmentStats = async () => {
  try {
    const cacheKey = 'equipment-stats';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const [total, active, idle, maintenance] = await Promise.all([
      equipmentModel.countDocuments(),
      equipmentModel.countDocuments({ status: 'active' }),
      equipmentModel.countDocuments({ status: 'idle' }),
      equipmentModel.countDocuments({ status: 'maintenance' }),
    ]);

    const result = {
      status: 200,
      data: { total, active, idle, maintenance }
    };

    cache.set(cacheKey, result, 60_000);
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchEquipmentStats:', error);
    return { status: 500, message: error.message };
  }
};

const fetchRealTimeStats = async () => {
  try {
    const cacheKey = 'realtime-stats';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo   = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yearAgo    = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const complaintEntry = REGISTRY.find(r => r.key === 'complaints');

    const [
      totalEq, activeEq, idleEq, maintenanceEq,
      pendingComplaints,
      todayCounts, weeklyCounts, monthlyCounts, yearlyCounts,
    ] = await Promise.all([
      equipmentModel.countDocuments(),
      equipmentModel.countDocuments({ status: 'active' }),
      equipmentModel.countDocuments({ status: 'idle' }),
      equipmentModel.countDocuments({ status: 'maintenance' }),
      complaintEntry.model.countDocuments({ status: 'pending' }),
      countsForRange(todayStart),
      countsForRange(weekAgo),
      countsForRange(monthAgo),
      countsForRange(yearAgo),
    ]);

    const todayTotal     = sumValues(todayCounts);
    const criticalAlerts = Math.round(pendingComplaints * 0.3);
    const efficiency     = todayTotal > 0
      ? Math.round(((todayTotal - pendingComplaints) / todayTotal) * 100)
      : 95;

    const trends = [
      { period: 'Daily',   ...todayCounts,   total: todayTotal               },
      { period: 'Weekly',  ...weeklyCounts,  total: sumValues(weeklyCounts)  },
      { period: 'Monthly', ...monthlyCounts, total: sumValues(monthlyCounts) },
      { period: 'Yearly',  ...yearlyCounts,  total: sumValues(yearlyCounts)  },
    ];

    const performanceMetrics = REGISTRY
      .map(({ key, label }) => ({ key, label, value: todayCounts[key] || 0 }))
      .filter(m => m.value > 0);

    const result = {
      status: 200,
      data: {
        equipment: {
          total:       totalEq,
          active:      activeEq,
          idle:        idleEq,
          maintenance: maintenanceEq,
        },
        pendingComplaints,
        criticalAlerts,
        efficiency: {
          todayTotal,
          pct: efficiency,
        },
        todayCounts,
        weeklyCounts,
        monthlyCounts,
        yearlyCounts,
        trends,
        performanceMetrics,
      }
    };

    cache.set(cacheKey, result, 60_000);
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchRealTimeStats:', error); 
    return { status: 500, message: error.message };
  }
};

const fetchLatest5 = async () => {
  try {
    const cacheKey = 'latest-5';
    const cached   = cache.get(cacheKey);
    if (cached) return cached;

    const allDocs = [];

    await Promise.all(
      REGISTRY.map(async ({ model, key, label }) => {
        const docs = await model.find().sort({ createdAt: -1 }).limit(5).lean();
        docs.forEach(doc => allDocs.push({ ...doc, _collection: key, _label: label }));
      })
    );

    allDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const result = {
      status: 200,
      data:   allDocs.slice(0, 5),
    };

    cache.set(cacheKey, result, 30_000);
    return result;
  } catch (error) {
    console.error('[DashboardService] fetchLatest5:', error);
    return { status: 500, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache clear
// ─────────────────────────────────────────────────────────────────────────────

const clearCache = () => {
  cache.clear();
  return { status: 200, message: 'Cache cleared.' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  fetchStatistics,
  fetchGraphData,
  fetchLatest,
  fetchHistorical,
  fetchComparison,
  fetchDetailed,
  fetchActivityHeatmap,
  fetchDataQuality,
  fetchEquipmentStats,
  fetchRealTimeStats,
  clearCache,
  fetchLatest5
};