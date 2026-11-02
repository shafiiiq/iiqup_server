const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const summaryService = require('./notification.summary.service');
const categoryService = require('./notification.category.service');

const SUMMARY_LOADERS = {
  category: summaryService.listCategorySummaries,
  person: summaryService.listPersonSummaries,
};

const getSummary = handleNotificationRoute('getSummary', async (req) => {
  const loadSummary = SUMMARY_LOADERS[req.query.groupBy];
  if (!loadSummary) throw new AppError('groupBy must be category or person', HTTP.BAD_REQUEST);
  return { status: HTTP.OK, message: 'Summary retrieved', data: await loadSummary(req.user.uniqueCode) };
});

const searchCategories = handleNotificationRoute('searchCategories', async (req) => ({
  status: HTTP.OK,
  message: 'Categories retrieved',
  data: await categoryService.searchCategories(req.query.q),
}));

module.exports = { getSummary, searchCategories };