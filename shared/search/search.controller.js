const { searchRegistry } = require('./search.registry');
const { buildSearchQuery, normalizeSources } = require('./search.util');
const { paginate } = require('../pagination/pagination.util');

const globalSearch = async (req, res, next) => {
  try {
    const q = String(req.body?.q ?? req.query?.q ?? '').trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query "q" is required.',
      });
    }

    const sources = normalizeSources(req.body?.source ?? req.query?.source ?? 'all');
    const allowedSources = Object.keys(searchRegistry);
    const sourceList = sources.filter((source) => allowedSources.includes(source));

    if (!sourceList.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid search sources were provided.',
      });
    }

    const results = {};
    for (const source of sourceList) {
      const entry = searchRegistry[source];
      if (!entry?.model) {
        results[source] = {
          data: [],
          pagination: {
            currentPage: req.pagination?.page || 1,
            totalPages: 0,
            totalCount: 0,
            hasMore: false,
          },
        };
        continue;
      }

      const model = entry.model;
      const query = buildSearchQuery(entry.searchableFields, q);
      const result = await paginate(model, query, req.pagination, {
        sort: { createdAt: -1 },
      });

      results[source] = result;
    }

    return res.status(200).json({
      success: true,
      query: q,
      sources: sourceList,
      results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
};
