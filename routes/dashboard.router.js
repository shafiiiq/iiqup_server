const express    = require('express');
const router     = express.Router();
const analyser   = require('../analyser/dashboard.analyser');
const { REGISTRY, getSchemaMap } = require('../registry/model.registry');

// ─── Schema endpoint ──────────────────────────────────────────────────────────
// Frontend calls this once on load to know all collections + their fields
router.get('/schema', (req, res) => {
  res.json({ status: 200, data: getSchemaMap() });
});

// ─── Statistics ───────────────────────────────────────────────────────────────
// GET /dashboard/statistics?period=month
// period: today | week | month | quarter | year
router.get('/statistics', async (req, res) => {
  const { period = 'month' } = req.query;
  const result = await analyser.fetchStatistics(period);
  res.status(result.status).json(result);
});

// ─── Graphs ───────────────────────────────────────────────────────────────────
// GET /dashboard/graphs?granularity=daily&points=7
// granularity: daily | weekly | monthly | yearly
router.get('/graphs', async (req, res) => {
  const { granularity = 'daily', points = 7 } = req.query;
  const result = await analyser.fetchGraphData(granularity, Number(points));
  res.status(result.status).json(result);
});

// ─── Latest ───────────────────────────────────────────────────────────────────
// GET /dashboard/latest?days=2&limit=20
router.get('/latest', async (req, res) => {
  const { days = 2, limit = 20 } = req.query;
  const result = await analyser.fetchLatest(Number(days), Number(limit));
  res.status(result.status).json(result);
});

// ─── Historical ───────────────────────────────────────────────────────────────
// GET /dashboard/historical?period=month&limit=100
// period: today | week | month | quarter | year
router.get('/historical', async (req, res) => {
  const { period = 'month', limit = 100 } = req.query;
  const result = await analyser.fetchHistorical(period, Number(limit));
  res.status(result.status).json(result);
});

// ─── Comparison ───────────────────────────────────────────────────────────────
// POST /dashboard/comparison
// body: { ranges: [{ label, start, end }, ...] }
router.post('/comparison', async (req, res) => {
  const { ranges } = req.body;
  const result = await analyser.fetchComparison(ranges);
  res.status(result.status).json(result);
});

// ─── Detailed ─────────────────────────────────────────────────────────────────
// GET /dashboard/detailed/:collection?months=1&page=1&pageSize=50
// collection: any registry key (equipment, stocks, etc.)
router.get('/detailed/:collection', async (req, res) => {
  const { collection }               = req.params;
  const { months = 1, page = 1, pageSize = 50 } = req.query;
  const result = await analyser.fetchDetailed(collection, Number(months), Number(page), Number(pageSize));
  res.status(result.status).json(result);
});

// ─── Business intelligence ────────────────────────────────────────────────────
// GET /dashboard/heatmap?days=30
router.get('/heatmap', async (req, res) => {
  const { days = 30 } = req.query;
  const result = await analyser.fetchActivityHeatmap(Number(days));
  res.status(result.status).json(result);
});

// GET /dashboard/data-quality
router.get('/data-quality', async (req, res) => {
  const result = await analyser.fetchDataQuality();
  res.status(result.status).json(result);
});

// ─── Cache ────────────────────────────────────────────────────────────────────
router.post('/clear-cache', (req, res) => {
  const result = analyser.clearCache();
  res.status(result.status).json(result);
});

// ─── Collections list (for frontend dropdowns) ────────────────────────────────
router.get('/collections', (req, res) => {
  res.json({ status: 200, data: REGISTRY.map(({ key, label }) => ({ key, label })) });
});


// ─── Legacy route aliases (keeps frontend working) ────────────────────────────
router.get('/get-daily-updates',            async (req, res) => {
  const result = await analyser.fetchHistorical('today', 50);
  res.status(result.status).json(result);
});
router.get('/get-weekly-updates',           async (req, res) => {
  const result = await analyser.fetchHistorical('week', 50);
  res.status(result.status).json(result);
});
router.get('/get-monthly-updates',          async (req, res) => {
  const result = await analyser.fetchHistorical('month', 100);
  res.status(result.status).json(result);
});
router.get('/get-yearly-updates',           async (req, res) => {
  const result = await analyser.fetchHistorical('year', 200);
  res.status(result.status).json(result);
});
router.get('/get-last-5-days-comparison',   async (req, res) => {
  const result = await analyser.fetchLast5DaysComparison();
  res.status(result.status).json(result);
});
router.get('/get-last-5-months-comparison', async (req, res) => {
  const result = await analyser.fetchLast5MonthsComparison();
  res.status(result.status).json(result);
});
router.get('/get-last-5-years-comparison',  async (req, res) => {
  const result = await analyser.fetchLast5YearsComparison();
  res.status(result.status).json(result);
});
router.get('/equipment-stats', async (req, res) => {
  try {
    const result = await analyser.fetchEquipmentStats();
    res.status(result.status).json(result);
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});
module.exports = router;