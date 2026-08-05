const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Reads page/limit from req.body or req.query (body takes priority
 * since your project sends pagination via POST body).
 * Attaches req.pagination = { page, limit, skip }
 */
const paginationMiddleware = (req, res, next) => {
  const source = { ...req.query, ...req.body };

  let page = parseInt(source.page, 10) || DEFAULT_PAGE;
  let limit = parseInt(source.limit, 10) || DEFAULT_LIMIT;

  if (page < 1) page = DEFAULT_PAGE;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;

  req.pagination = { page, limit, skip };
  next();
};

module.exports = paginationMiddleware;