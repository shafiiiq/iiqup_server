const { REGISTRY } = require('./registry/model.registry');
const { getRegistryEntry } = require('./registry/registry.util');
const { buildDateRangeQuery } = require('./dashboard.query');
const { buildProjection } = require('./dashboard.sanitizer');
const { paginate } = require('#shared/pagination/pagination');

const sumCounts = (countsByKey) => Object.values(countsByKey).reduce((sum, n) => sum + n, 0);

const countAllModelsInRange = async (start, end) => {
  const query = buildDateRangeQuery(start, end);
  const entries = await Promise.all(
    REGISTRY.map(async ({ model, key }) => [key, await model.countDocuments(query)])
  );
  return Object.fromEntries(entries);
};

const countAllModelsAllTime = async () => {
  const entries = await Promise.all(
    REGISTRY.map(async ({ model, key }) => [key, await model.countDocuments({})])
  );
  return Object.fromEntries(entries);
};

const countModelByFieldValue = async (key, field) => {
  const entry = getRegistryEntry(key);
  if (!entry || typeof entry.model.aggregate !== 'function') return [];

  const rows = await entry.model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return rows.map((row) => ({ value: row._id ?? 'unspecified', count: row.count }));
};

const fetchModelRecordsPage = async (key, start, end, pagination) => {
  const entry = getRegistryEntry(key);
  const emptyPage = { data: [], pagination: { currentPage: pagination.page, totalPages: 0, totalCount: 0, hasMore: false } };
  if (!entry) return emptyPage;

  const query = buildDateRangeQuery(start, end);
  const projection = buildProjection();
  return paginate(entry.model, query, pagination, { projection });
};

const fetchRecentDocsAcrossModels = async (limitPerModel) => {
  const projection = buildProjection();
  const perModel = await Promise.all(
    REGISTRY.map(async ({ model, key, label }) => {
      const docs = await model.find({}, projection).sort({ createdAt: -1 }).limit(limitPerModel).lean();
      return docs.map((doc) => ({ ...doc, _collection: key, _label: label }));
    })
  );
  return perModel.flat();
};

module.exports = {
  sumCounts,
  countAllModelsInRange,
  countAllModelsAllTime,
  countModelByFieldValue,
  fetchModelRecordsPage,
  fetchRecentDocsAcrossModels,
};
