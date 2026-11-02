const { Types } = require('mongoose');
const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');

const encodeCursor = (document, sortField) =>
  Buffer.from(
    JSON.stringify({ value: new Date(document[sortField]).toISOString(), id: String(document._id) })
  ).toString('base64url');

const decodeCursor = (cursor) => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Types.ObjectId.isValid(parsed.id) || Number.isNaN(Date.parse(parsed.value))) throw new Error('invalid');
    return { value: new Date(parsed.value), id: new Types.ObjectId(parsed.id) };
  } catch {
    throw new AppError('Invalid cursor', HTTP.BAD_REQUEST);
  }
};

const clampLimit = (value, defaultLimit, maxLimit) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
};

const paginateByCursor = async (
  Model,
  baseQuery,
  { cursor, limit, direction = 'desc', sortField = 'createdAt', projection = null }
) => {
  const isDescending = direction === 'desc';
  const comparison = isDescending ? '$lt' : '$gt';
  const sortDirection = isDescending ? -1 : 1;

  let query = baseQuery;
  if (cursor) {
    const position = decodeCursor(cursor);
    query = {
      $and: [
        baseQuery,
        {
          $or: [
            { [sortField]: { [comparison]: position.value } },
            { [sortField]: position.value, _id: { [comparison]: position.id } },
          ],
        },
      ],
    };
  }

  const documents = await Model.find(query, projection)
    .sort({ [sortField]: sortDirection, _id: sortDirection })
    .limit(limit + 1)
    .lean();

  const hasMore = documents.length > limit;
  const items = hasMore ? documents.slice(0, limit) : documents;

  return {
    items,
    pagination: { hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1], sortField) : null },
  };
};

module.exports = { paginateByCursor, clampLimit, encodeCursor };