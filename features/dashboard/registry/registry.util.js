const { REGISTRY } = require('./model.registry');

const getRegistryEntry = (key) => REGISTRY.find((entry) => entry.key === key) || null;

const listRegistryKeys = () => REGISTRY.map((entry) => entry.key);

const listRegistryOptions = () =>
  REGISTRY.map(({ key, label, direction }) => ({ key, label, direction }));

const getDirection = (key) => getRegistryEntry(key)?.direction || 'neutral';

const getSchemaMap = () => {
  const map = {};
  REGISTRY.forEach(({ model, key, label }) => {
    map[key] = {
      label,
      fields: Object.entries(model.schema.paths)
        .filter(([path]) => !['__v', '_id'].includes(path))
        .map(([path, schemaType]) => ({
          path,
          type: schemaType.instance || typeof schemaType.defaultValue,
        })),
    };
  });
  return map;
};

module.exports = { getRegistryEntry, listRegistryKeys, listRegistryOptions, getDirection, getSchemaMap };
