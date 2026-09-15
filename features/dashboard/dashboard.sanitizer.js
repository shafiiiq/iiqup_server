const DEFAULT_EXCLUDED_FIELDS = ['__v'];

const buildProjection = (excludedFields = DEFAULT_EXCLUDED_FIELDS) =>
  excludedFields.reduce((projection, field) => ({ ...projection, [field]: 0 }), {});

module.exports = { DEFAULT_EXCLUDED_FIELDS, buildProjection };
