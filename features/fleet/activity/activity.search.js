const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchClause = (searchFields, searchTerm) => {
  const trimmedTerm = String(searchTerm || '').trim();
  if (!trimmedTerm) return {};

  const pattern = new RegExp(escapeRegex(trimmedTerm), 'i');
  return { $or: searchFields.map((field) => ({ [field]: { $regex: pattern } })) };
};

const buildActivitySourceQuery = ({ filterQuery, tabQuery, searchFields, searchTerm }) => ({
  $and: [filterQuery, tabQuery, buildSearchClause(searchFields, searchTerm)],
});

module.exports = { buildActivitySourceQuery };