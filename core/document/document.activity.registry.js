const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');

const activitySources = new Map();

const registerDocumentActivitySource = (sourceKey, definition) => {
  const isComplete = definition.model && typeof definition.referenceField === 'string';
  if (!isComplete) throw new Error(`Document activity source ${sourceKey} is incomplete`);
  activitySources.set(sourceKey, definition);
};

const resolveDocumentActivitySource = (sourceKey) => {
  const definition = activitySources.get(sourceKey);
  if (!definition) throw new AppError('Unknown document source', HTTP.BAD_REQUEST);
  return definition;
};

const listDocumentActivitySources = () =>
  [...activitySources.entries()].map(([sourceKey, definition]) => ({ sourceKey, ...definition }));

module.exports = { registerDocumentActivitySource, resolveDocumentActivitySource, listDocumentActivitySources };