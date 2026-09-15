const { DIRECTION } = require('./registry/model.registry');
const { getDirection } = require('./registry/registry.util');

const computeNetScore = (countsByKey) =>
  Object.entries(countsByKey).reduce((score, [key, count]) => {
    const direction = getDirection(key);
    if (direction === DIRECTION.GROWTH) return score + count;
    if (direction === DIRECTION.LOSS) return score - count;
    return score;
  }, 0);

const splitCountsByDirection = (countsByKey) => {
  const totals = { growth: 0, loss: 0, neutral: 0 };
  Object.entries(countsByKey).forEach(([key, count]) => {
    totals[getDirection(key)] += count;
  });
  return totals;
};

module.exports = { computeNetScore, splitCountsByDirection };
