const normalizeSources = (source) => {
  if (!source || source === 'all') {
    return Object.keys(require('./search.registry').searchRegistry);
  }

  if (Array.isArray(source)) {
    return source
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean);
  }

  return String(source)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const buildSearchQuery = (fields = [], q = '') => {
  const value = String(q || '').trim();
  if (!value) return {};

  const cleanFields = fields.filter(Boolean);
  if (!cleanFields.length) return {};

  const regex = new RegExp(value, 'i');
  return {
    $or: cleanFields.map((field) => ({ [field]: { $regex: regex } })),
  };
};

module.exports = {
  normalizeSources,
  buildSearchQuery,
};
