const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { distributionRegistry } = require('#core/registry/distribution.registry');

const submitDistribution = async ({ distributionKey, payload, notificationId, user, userId }) => {
  if (!Object.hasOwn(distributionRegistry, distributionKey)) {
    throw new AppError('Unknown distribution', HTTP.BAD_REQUEST);
  }
  return distributionRegistry[distributionKey].submit({ payload: payload || {}, notificationId, user, userId });
};

const listFieldSuggestions = async ({ distributionKey, fieldKey, term }) => {
  if (!Object.hasOwn(distributionRegistry, distributionKey)) {
    throw new AppError('Unknown distribution', HTTP.BAD_REQUEST);
  }
  const field = distributionRegistry[distributionKey].fields.find((candidate) => candidate.key === fieldKey);
  if (!field?.suggest) return [];
  return field.suggest(term);
};

module.exports = { submitDistribution, listFieldSuggestions };