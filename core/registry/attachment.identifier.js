const readTrailingNumber = (reference) => Number(/(\d+)$/.exec(String(reference || ''))?.[1] ?? 0);

module.exports = { readTrailingNumber };