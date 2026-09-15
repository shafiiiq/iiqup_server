const buildDateRangeQuery = (start, end) => ({
  $or: [
    { createdAt: { $gte: start, $lte: end } },
    { updatedAt: { $gte: start, $lte: end } },
  ],
});

module.exports = { buildDateRangeQuery };
