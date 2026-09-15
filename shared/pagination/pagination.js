const paginate = async (Model, query, pagination, options = {}) => {
  const { page, limit, skip } = pagination;
  const { sort = { createdAt: -1 }, projection = null, populate = null } = options;

  let dbQuery = Model.find(query, projection).sort(sort).skip(skip).limit(limit).lean();
  if (populate) dbQuery = dbQuery.populate(populate);

  const [data, totalCount] = await Promise.all([
    dbQuery,
    Model.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasMore: page < totalPages,
    },
  };
};

module.exports = { paginate };