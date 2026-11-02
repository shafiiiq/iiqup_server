const logger = require('#shared/logger/logger');
const Staff = require('#features/user/staff/staff.model');
require('./document.activity.sources');
const { listDocumentActivitySources, resolveDocumentActivitySource } = require('./document.activity.registry');
const { UNSEEN_DOCUMENT_WINDOW_MS, UNSEEN_REFERENCE_LIMIT } = require('./document.activity.constant');

const WITHOUT_TIMESTAMP_UPDATE = { timestamps: false };

const buildDefaultScope = () => ({ createdAt: { $gte: new Date(Date.now() - UNSEEN_DOCUMENT_WINDOW_MS) } });

const buildUnseenFilter = (definition, uniqueCode) => ({
  ...(definition.buildUnseenScope ? definition.buildUnseenScope() : buildDefaultScope()),
  'viewedBy.uniqueCode': { $ne: uniqueCode },
});

const loadSourceUnseen = async (definition, uniqueCode) => {
  const filter = buildUnseenFilter(definition, uniqueCode);
  const [count, rows] = await Promise.all([
    definition.model.countDocuments(filter),
    definition.model.find(filter).select(definition.referenceField).sort({ _id: -1 }).limit(UNSEEN_REFERENCE_LIMIT).lean(),
  ]);
  return { count, references: rows.map((row) => String(row[definition.referenceField])) };
};

const countUnseenDocuments = async (uniqueCode) => {
  const isStaff = Boolean(await Staff.exists({ uniqueCode }));
  const entries = await Promise.all(
    listDocumentActivitySources().map(async (definition) => [
      definition.sourceKey,
      isStaff ? await loadSourceUnseen(definition, uniqueCode) : { count: 0, references: [] },
    ])
  );
  return {
    bySource: Object.fromEntries(entries.map(([key, value]) => [key, value.count])),
    referencesBySource: Object.fromEntries(entries.map(([key, value]) => [key, value.references])),
    total: entries.reduce((sum, [, value]) => sum + value.count, 0),
  };
};

const markDocumentViewed = async ({ uniqueCode, sourceKey, documentId }) => {
  const definition = resolveDocumentActivitySource(sourceKey);
  await definition.model.updateOne(
    { [definition.referenceField]: documentId, 'viewedBy.uniqueCode': { $ne: uniqueCode } },
    { $push: { viewedBy: { uniqueCode, viewedAt: new Date() } } },
    WITHOUT_TIMESTAMP_UPDATE
  );
};

const markDocumentsViewed = async ({ uniqueCode, sourceKey, documentIds }) => {
  if (!uniqueCode || documentIds.length === 0) return;
  const definition = resolveDocumentActivitySource(sourceKey);
  await definition.model.updateMany(
    { [definition.referenceField]: { $in: documentIds }, 'viewedBy.uniqueCode': { $ne: uniqueCode } },
    { $push: { viewedBy: { uniqueCode, viewedAt: new Date() } } },
    WITHOUT_TIMESTAMP_UPDATE
  );
};

const markDocumentsViewedSafely = (params) =>
  markDocumentsViewed(params).catch((error) => logger.error('[document.view] markDocumentsViewedSafely:', error));

const markAllDocumentsViewed = async ({ uniqueCode, sourceKey }) => {
  const definition = resolveDocumentActivitySource(sourceKey);
  await definition.model.updateMany(
    buildUnseenFilter(definition, uniqueCode),
    { $push: { viewedBy: { uniqueCode, viewedAt: new Date() } } },
    WITHOUT_TIMESTAMP_UPDATE
  );
};

module.exports = {
  countUnseenDocuments,
  markDocumentViewed,
  markDocumentsViewed,
  markDocumentsViewedSafely,
  markAllDocumentsViewed,
};