const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const { clampLimit } = require('#shared/pagination/pagination.cursor');

const activityService = require('./activity.service');
const { ACTIVITY_TABS, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT } = require('./activity.constant');
const { validateActivityFeedQuery } = require('./activity.validation');
const { buildActivityFilterQuery } = require('./activity.filter');

const resolveErrorStatus = (error) => error.statusCode || error.status || HTTP.INTERNAL_SERVER_ERROR;

const getActivityFeed = async (req, res) => {
  try {
    const validationMessage = validateActivityFeedQuery(req.query);
    if (validationMessage) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: validationMessage });
    }

    const { tab = ACTIVITY_TABS.ALL, cursor, search } = req.query;
    const limit = clampLimit(req.query.limit, ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT);

    const result = await activityService.fetchActivityFeed({
      tab,
      filterQuery: buildActivityFilterQuery(req.query),
      searchTerm: search,
      cursor,
      limit,
    });
    respond(res, result);
  } catch (error) {
    logger.error('[ActivityController] getActivityFeed:', error);
    respond(res, { status: resolveErrorStatus(error), ok: false, message: error.message });
  }
};

const getActivityCounts = async (req, res) => {
  try {
    const validationMessage = validateActivityFeedQuery(req.query);
    if (validationMessage) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: validationMessage });
    }

    const result = await activityService.fetchActivityCounts(
      buildActivityFilterQuery(req.query),
      req.query.search
    );
    respond(res, result);
  } catch (error) {
    logger.error('[ActivityController] getActivityCounts:', error);
    respond(res, { status: resolveErrorStatus(error), ok: false, message: error.message });
  }
};

const getActivityDetail = async (req, res) => {
  try {
    const result = await activityService.fetchActivityDetail(req.params.source, req.params.activityId);
    respond(res, result);
  } catch (error) {
    logger.error('[ActivityController] getActivityDetail:', error);
    respond(res, { status: resolveErrorStatus(error), ok: false, message: error.message });
  }
};

module.exports = { getActivityFeed, getActivityCounts, getActivityDetail };