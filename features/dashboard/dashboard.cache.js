const store = new Map();

const setCache = (key, value, ttlMs = 60000) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const getCache = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
};

const clearCache = () => store.clear();

module.exports = { setCache, getCache, clearCache };
