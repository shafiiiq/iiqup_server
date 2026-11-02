const mongoose = require('mongoose');
const HTTP = require('#shared/response/response.status');
const { paginateByCursor, encodeCursor } = require('#shared/pagination/pagination.cursor');

const { ACTIVITY_SORT_FIELD, TAB_SOURCE_QUERIES } = require('./activity.constant');
const { ACTIVITY_SOURCE_REGISTRY } = require('./activity.source');
const { buildFeedItem, buildDetail } = require('./activity.compose');
const { fetchActivityMaps } = require('./activity.enrichment');
const { buildActivitySourceQuery } = require('./activity.search');

const compareActivityEntries = (firstEntry, secondEntry) => {
  const dateDifference = new Date(secondEntry.record.date) - new Date(firstEntry.record.date);
  if (dateDifference !== 0) return dateDifference;
  return String(secondEntry.record._id).localeCompare(String(firstEntry.record._id));
};

const fetchSourcePage = async ({ source, query }, filterQuery, searchTerm, cursor, limit) => {
  const sourceConfig = ACTIVITY_SOURCE_REGISTRY[source];
  const page = await paginateByCursor(
    sourceConfig.model,
    buildActivitySourceQuery({
      filterQuery,
      tabQuery: query,
      searchFields: sourceConfig.searchFields,
      searchTerm,
    }),
    { cursor, limit, sortField: ACTIVITY_SORT_FIELD }
  );
  return { source, items: page.items, hasMore: page.pagination.hasMore };
};

const fetchActivityFeed = async ({ tab, filterQuery, searchTerm, cursor, limit }) => {
  const sourcePages = await Promise.all(
    TAB_SOURCE_QUERIES[tab].map((sourceQuery) =>
      fetchSourcePage(sourceQuery, filterQuery, searchTerm, cursor, limit)
    )
  );

  const mergedEntries = sourcePages
    .flatMap((sourcePage) => sourcePage.items.map((record) => ({ source: sourcePage.source, record })))
    .sort(compareActivityEntries);

  const hasMore = mergedEntries.length > limit || sourcePages.some((sourcePage) => sourcePage.hasMore);
  const pageEntries = mergedEntries.slice(0, limit);
  const nextCursor =
    hasMore && pageEntries.length
      ? encodeCursor(pageEntries[pageEntries.length - 1].record, ACTIVITY_SORT_FIELD)
      : null;

  const contents = pageEntries.map((entry) => ACTIVITY_SOURCE_REGISTRY[entry.source].format(entry.record));
  const { imageMap, operatorMap, equipmentMap } = await fetchActivityMaps(pageEntries, contents);

  const items = pageEntries.map((entry, entryIndex) =>
    buildFeedItem({
      source: entry.source,
      record: entry.record,
      content: contents[entryIndex],
      imageMap,
      operatorMap,
      equipmentMap,
    })
  );

  return {
    status: HTTP.OK,
    ok: true,
    data: items,
    pagination: { hasMore, nextCursor },
  };
};

const countTabRecords = async (tab, filterQuery, searchTerm) => {
  const sourceCounts = await Promise.all(
    TAB_SOURCE_QUERIES[tab].map(({ source, query }) => {
      const sourceConfig = ACTIVITY_SOURCE_REGISTRY[source];
      return sourceConfig.model.countDocuments(
        buildActivitySourceQuery({
          filterQuery,
          tabQuery: query,
          searchFields: sourceConfig.searchFields,
          searchTerm,
        })
      );
    })
  );
  return sourceCounts.reduce((total, sourceCount) => total + sourceCount, 0);
};

const fetchActivityCounts = async (filterQuery, searchTerm) => {
  const tabs = Object.keys(TAB_SOURCE_QUERIES);
  const tabTotals = await Promise.all(tabs.map((tab) => countTabRecords(tab, filterQuery, searchTerm)));

  return {
    status: HTTP.OK,
    ok: true,
    data: Object.fromEntries(tabs.map((tab, tabIndex) => [tab, tabTotals[tabIndex]])),
  };
};

const fetchActivityDetail = async (source, activityId) => {
  const sourceConfig = ACTIVITY_SOURCE_REGISTRY[source];
  if (!sourceConfig) {
    return { status: HTTP.BAD_REQUEST, ok: false, message: 'Invalid activity source' };
  }
  if (!mongoose.Types.ObjectId.isValid(activityId)) {
    return { status: HTTP.BAD_REQUEST, ok: false, message: 'Invalid activity ID' };
  }

  const record = await sourceConfig.model.findById(activityId).lean();
  if (!record) {
    return { status: HTTP.NOT_FOUND, ok: false, message: 'Activity not found' };
  }

  const context = await sourceConfig.fetchContext(record);
  const content = sourceConfig.format(record, context);
  const entries = [{ source, record }];
  const { imageMap, operatorMap, equipmentMap } = await fetchActivityMaps(entries, [content]);

  return {
    status: HTTP.OK,
    ok: true,
    data: buildDetail({ source, record, content, imageMap, operatorMap, equipmentMap }),
  };
};

module.exports = { fetchActivityFeed, fetchActivityCounts, fetchActivityDetail };