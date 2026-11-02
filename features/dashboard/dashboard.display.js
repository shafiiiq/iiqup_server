const { getDisplayFields } = require('./registry/registry.display');
const { buildProjection } = require('./dashboard.sanitizer');

const toReadableText = (text) => {
  const spaced = String(text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const toDisplayValue = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const readFieldValues = (current, segments) => {
  if (current == null) return [];
  if (Array.isArray(current)) return current.flatMap((item) => readFieldValues(item, segments));
  if (segments.length === 0) return [current];
  const [firstSegment, ...remainingSegments] = segments;
  return readFieldValues(current[firstSegment], remainingSegments);
};

const readPlainText = (record, path) =>
  toDisplayValue(
    path.split('.').reduce((current, segment) => (current == null ? undefined : current[segment]), record)
  );

const readArrayText = (record, path) =>
  readFieldValues(record, path.split('.'))
    .map(toDisplayValue)
    .filter((value) => value !== '')
    .join(', ');

const buildProjectionForKey = (key) => {
  const displayFields = getDisplayFields(key);
  if (displayFields.length === 0) return buildProjection();
  return displayFields.reduce((projection, { path }) => ({ ...projection, [path]: 1 }), { createdAt: 1 });
};

const buildDisplayRows = (key, record) =>
  getDisplayFields(key)
    .map(({ path, label, format, array }) => {
      const text = array ? readArrayText(record, path) : readPlainText(record, path);
      return { label, value: format ? toReadableText(text) : text };
    })
    .filter((row) => row.value !== '');

module.exports = { buildProjectionForKey, buildDisplayRows };